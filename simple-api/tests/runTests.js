const { spawn, execSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const scenarios = require('./scenarios');

const projectRoot = path.join(__dirname, '..');
const testPort = 3100;
const baseUrl = `http://localhost:${testPort}`;
const reportName = process.argv[2] || 'run';
const resultsDir = path.join(projectRoot, 'reports', reportName, 'allure-results');
const reportDir = path.join(projectRoot, 'reports', reportName, 'allure-report');

const startServer = () =>
  new Promise((resolve, reject) => {
    const serverProcess = spawn(process.execPath, ['src/server.js'], {
      cwd: projectRoot,
      env: { ...process.env, PORT: String(testPort) }
    });
    serverProcess.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Server is running')) resolve(serverProcess);
    });
    serverProcess.on('error', reject);
    serverProcess.on('exit', (code) => reject(new Error(`Server exited early with code ${code}`)));
  });

const sendRequest = async ({ method, path: requestPath, headers, body }) => {
  const rawResponse = await fetch(`${baseUrl}${requestPath}`, { method, headers, body });
  const bodyText = await rawResponse.text();
  let json;
  try {
    json = JSON.parse(bodyText);
  } catch {
    json = undefined;
  }
  return {
    status: rawResponse.status,
    headers: Object.fromEntries(rawResponse.headers),
    bodyText,
    json
  };
};

const evaluateScenario = (scenario, response) => {
  if (response.status !== scenario.expectedStatus) {
    return `Expected status ${scenario.expectedStatus} but received ${response.status}`;
  }
  return scenario.verify(response);
};

const writeAttachment = (name, type, extension, content) => {
  const source = `${crypto.randomUUID()}-attachment.${extension}`;
  fs.writeFileSync(path.join(resultsDir, source), content, 'utf8');
  return { name, source, type };
};

const describeRequest = ({ method, path: requestPath, headers, body, bodyNote }) =>
  [`${method} ${baseUrl}${requestPath}`, JSON.stringify(headers), bodyNote || body || ''].join('\n');

const describeResponse = (response) =>
  [`Status: ${response.status}`, JSON.stringify(response.headers, null, 2), '', response.bodyText.slice(0, 2000)].join('\n');

const buildAllureResult = (scenario, response, failureMessage, startTime, stopTime) => {
  const status = failureMessage ? 'failed' : 'passed';
  const attachments = [
    writeAttachment('Request', 'text/plain', 'txt', describeRequest(scenario.request)),
    writeAttachment('Response', 'text/plain', 'txt', describeResponse(response))
  ];
  return {
    uuid: crypto.randomUUID(),
    historyId: crypto.createHash('md5').update(`${scenario.suite}:${scenario.title}`).digest('hex'),
    name: `${scenario.id} ${scenario.title}`,
    fullName: `${scenario.suite}.${scenario.id}`,
    description: `Expected: ${scenario.expectedResult}`,
    status,
    statusDetails: failureMessage ? { message: failureMessage } : {},
    stage: 'finished',
    start: startTime,
    stop: stopTime,
    labels: [
      { name: 'suite', value: scenario.suite },
      { name: 'feature', value: scenario.type },
      { name: 'severity', value: scenario.severity }
    ],
    steps: [
      {
        name: `Send ${scenario.request.method} ${scenario.request.path}`,
        status: 'passed',
        stage: 'finished',
        start: startTime,
        stop: stopTime,
        attachments
      },
      {
        name: scenario.expectedResult,
        status,
        statusDetails: failureMessage ? { message: failureMessage } : {},
        stage: 'finished',
        start: stopTime,
        stop: stopTime
      }
    ]
  };
};

const runScenario = async (scenario) => {
  const startTime = Date.now();
  const response = await sendRequest(scenario.request);
  const failureMessage = evaluateScenario(scenario, response);
  const allureResult = buildAllureResult(scenario, response, failureMessage, startTime, Date.now());
  fs.writeFileSync(path.join(resultsDir, `${allureResult.uuid}-result.json`), JSON.stringify(allureResult), 'utf8');
  console.log(`${failureMessage ? 'FAILED' : 'PASSED'}  ${scenario.id} ${scenario.title}${failureMessage ? `\n        ${failureMessage}` : ''}`);
  return !failureMessage;
};

const writeEnvironmentFile = () => {
  const lines = [`baseUrl=${baseUrl}`, `nodeVersion=${process.version}`, `run=${reportName}`];
  fs.writeFileSync(path.join(resultsDir, 'environment.properties'), lines.join('\n'), 'utf8');
};

const generateReport = () => {
  execSync(`npx allure generate "${resultsDir}" --clean --single-file -o "${reportDir}"`, {
    cwd: projectRoot,
    stdio: 'ignore'
  });
};

const main = async () => {
  fs.rmSync(path.join(projectRoot, 'reports', reportName), { recursive: true, force: true });
  fs.mkdirSync(resultsDir, { recursive: true });
  const serverProcess = await startServer();
  serverProcess.removeAllListeners('exit');

  const outcomes = [];
  for (const scenario of scenarios) {
    outcomes.push(await runScenario(scenario));
  }
  serverProcess.kill();

  writeEnvironmentFile();
  generateReport();

  const passedCount = outcomes.filter(Boolean).length;
  console.log(`\n${reportName}: ${passedCount} passed, ${outcomes.length - passedCount} failed, ${outcomes.length} total`);
  console.log(`Report: ${path.join(reportDir, 'index.html')}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
