const fs = require('node:fs');
const path = require('node:path');
const scenarios = require('./scenarios');

const baseUrl = 'http://localhost:3000';
const outputDir = path.join(__dirname, 'output');

const escapeCsvValue = (value) => `"${String(value).replace(/"/g, '""')}"`;

const describeBody = (request) => request.bodyNote || request.body || '';

const buildCsv = () => {
  const header = ['id', 'suite', 'type', 'severity', 'title', 'method', 'path', 'contentType', 'requestBody', 'expectedStatus', 'expectedResult'];
  const rows = scenarios.map((scenario) => [
    scenario.id,
    scenario.suite,
    scenario.type,
    scenario.severity,
    scenario.title,
    scenario.request.method,
    scenario.request.path,
    scenario.request.headers['Content-Type'] || '',
    describeBody(scenario.request),
    scenario.expectedStatus,
    scenario.expectedResult
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n');
};

const buildHttpBlock = (scenario) => {
  const { method, path: requestPath, headers, body, bodyNote } = scenario.request;
  const headerLines = Object.entries(headers).map(([name, value]) => `${name}: ${value}`);
  const lines = [
    `### ${scenario.id} | ${scenario.title}`,
    `# Expected status: ${scenario.expectedStatus} | ${scenario.expectedResult}`,
    `${method} ${baseUrl}${requestPath}`,
    ...headerLines
  ];
  if (bodyNote) {
    lines.push('', `# Body: ${bodyNote}`);
  } else if (body) {
    lines.push('', body);
  }
  return lines.join('\n');
};

const buildHttpFile = () =>
  [
    '# Run the requests in order against a freshly started server (npm start).',
    '# The expected ids depend on the order of the valid POST requests.',
    '',
    ...scenarios.map(buildHttpBlock).map((block) => `${block}\n`)
  ].join('\n');

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'testScenarios.csv'), buildCsv(), 'utf8');
fs.writeFileSync(path.join(outputDir, 'httpRequests.http'), buildHttpFile(), 'utf8');
console.log(`Exported ${scenarios.length} scenarios to ${outputDir}`);
