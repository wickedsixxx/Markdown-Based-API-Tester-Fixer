const assert = require('node:assert');

const jsonHeaders = { 'Content-Type': 'application/json' };
const longName = 'a'.repeat(1000);
const oversizedName = 'a'.repeat(200 * 1024);

const verifyJsonEquals = (expectedBody) => (response) => {
  try {
    assert.deepStrictEqual(response.json, expectedBody);
    return null;
  } catch {
    return `Expected body ${JSON.stringify(expectedBody)} but received ${response.bodyText.slice(0, 200)}`;
  }
};

const verifyErrorMessagePresent = (response) =>
  response.json && typeof response.json.error === 'string' && response.json.error !== ''
    ? null
    : `Expected a JSON body with a non-empty "error" field but received ${response.bodyText.slice(0, 200)}`;

const verifyJsonContentType = (response) =>
  (response.headers['content-type'] || '').includes('application/json')
    ? null
    : `Expected a JSON error response but received content type "${response.headers['content-type']}"`;

const verifyPoweredByHeaderAbsent = (response) =>
  response.headers['x-powered-by'] === undefined
    ? null
    : `Header "X-Powered-By: ${response.headers['x-powered-by']}" exposes the server technology`;

const verifyNoStatusCheck = () => null;

const scenarios = [
  {
    suite: 'GET /items',
    type: 'happyPath',
    severity: 'critical',
    title: 'List is empty before any item is created',
    request: { method: 'GET', path: '/items', headers: {}, body: undefined },
    expectedStatus: 200,
    expectedResult: 'Response body is an empty array',
    verify: verifyJsonEquals([])
  },
  {
    suite: 'POST /items',
    type: 'happyPath',
    severity: 'blocker',
    title: 'Create an item with a valid name',
    request: { method: 'POST', path: '/items', headers: jsonHeaders, body: '{"name":"apple"}' },
    expectedStatus: 201,
    expectedResult: 'Response body is {"id":1,"name":"apple"}',
    verify: verifyJsonEquals({ id: 1, name: 'apple' })
  },
  {
    suite: 'GET /items',
    type: 'happyPath',
    severity: 'blocker',
    title: 'Created item is returned by the list',
    request: { method: 'GET', path: '/items', headers: {}, body: undefined },
    expectedStatus: 200,
    expectedResult: 'Response body is [{"id":1,"name":"apple"}]',
    verify: verifyJsonEquals([{ id: 1, name: 'apple' }])
  },
  {
    suite: 'POST /items',
    type: 'happyPath',
    severity: 'critical',
    title: 'Second item receives an incremented id',
    request: { method: 'POST', path: '/items', headers: jsonHeaders, body: '{"name":"banana"}' },
    expectedStatus: 201,
    expectedResult: 'Response body is {"id":2,"name":"banana"}',
    verify: verifyJsonEquals({ id: 2, name: 'banana' })
  },
  {
    suite: 'POST /items',
    type: 'edgeCase',
    severity: 'normal',
    title: 'Surrounding whitespace is trimmed from the name',
    request: { method: 'POST', path: '/items', headers: jsonHeaders, body: '{"name":"  cherry  "}' },
    expectedStatus: 201,
    expectedResult: 'Response body is {"id":3,"name":"cherry"}',
    verify: verifyJsonEquals({ id: 3, name: 'cherry' })
  },
  {
    suite: 'POST /items',
    type: 'edgeCase',
    severity: 'critical',
    title: 'Client supplied id and extra fields are ignored',
    request: {
      method: 'POST',
      path: '/items',
      headers: jsonHeaders,
      body: '{"name":"date","id":99,"role":"admin"}'
    },
    expectedStatus: 201,
    expectedResult: 'Response body is {"id":4,"name":"date"} without the extra fields',
    verify: verifyJsonEquals({ id: 4, name: 'date' })
  },
  {
    suite: 'POST /items',
    type: 'edgeCase',
    severity: 'normal',
    title: 'Unicode name is accepted',
    request: { method: 'POST', path: '/items', headers: jsonHeaders, body: '{"name":"çilek 🍓"}' },
    expectedStatus: 201,
    expectedResult: 'Response body is {"id":5,"name":"çilek 🍓"}',
    verify: verifyJsonEquals({ id: 5, name: 'çilek 🍓' })
  },
  {
    suite: 'POST /items',
    type: 'edgeCase',
    severity: 'critical',
    title: 'Missing name field is rejected',
    request: { method: 'POST', path: '/items', headers: jsonHeaders, body: '{}' },
    expectedStatus: 400,
    expectedResult: 'Response contains a JSON error message',
    verify: verifyErrorMessagePresent
  },
  {
    suite: 'POST /items',
    type: 'edgeCase',
    severity: 'critical',
    title: 'Empty string name is rejected',
    request: { method: 'POST', path: '/items', headers: jsonHeaders, body: '{"name":""}' },
    expectedStatus: 400,
    expectedResult: 'Response contains a JSON error message',
    verify: verifyErrorMessagePresent
  },
  {
    suite: 'POST /items',
    type: 'edgeCase',
    severity: 'normal',
    title: 'Whitespace only name is rejected',
    request: { method: 'POST', path: '/items', headers: jsonHeaders, body: '{"name":"   "}' },
    expectedStatus: 400,
    expectedResult: 'Response contains a JSON error message',
    verify: verifyErrorMessagePresent
  },
  {
    suite: 'POST /items',
    type: 'edgeCase',
    severity: 'normal',
    title: 'Numeric name is rejected',
    request: { method: 'POST', path: '/items', headers: jsonHeaders, body: '{"name":123}' },
    expectedStatus: 400,
    expectedResult: 'Response contains a JSON error message',
    verify: verifyErrorMessagePresent
  },
  {
    suite: 'POST /items',
    type: 'edgeCase',
    severity: 'normal',
    title: 'Null name is rejected',
    request: { method: 'POST', path: '/items', headers: jsonHeaders, body: '{"name":null}' },
    expectedStatus: 400,
    expectedResult: 'Response contains a JSON error message',
    verify: verifyErrorMessagePresent
  },
  {
    suite: 'POST /items',
    type: 'edgeCase',
    severity: 'normal',
    title: 'Array body is rejected',
    request: { method: 'POST', path: '/items', headers: jsonHeaders, body: '[{"name":"apple"}]' },
    expectedStatus: 400,
    expectedResult: 'Response contains a JSON error message',
    verify: verifyErrorMessagePresent
  },
  {
    suite: 'POST /items',
    type: 'edgeCase',
    severity: 'normal',
    title: 'Empty request body is rejected',
    request: { method: 'POST', path: '/items', headers: jsonHeaders, body: '' },
    expectedStatus: 400,
    expectedResult: 'Response contains a JSON error message',
    verify: verifyErrorMessagePresent
  },
  {
    suite: 'POST /items',
    type: 'edgeCase',
    severity: 'normal',
    title: 'Plain text content type is rejected',
    request: {
      method: 'POST',
      path: '/items',
      headers: { 'Content-Type': 'text/plain' },
      body: '{"name":"apple"}'
    },
    expectedStatus: 400,
    expectedResult: 'Response contains a JSON error message',
    verify: verifyErrorMessagePresent
  },
  {
    suite: 'POST /items',
    type: 'edgeCase',
    severity: 'critical',
    title: 'Malformed JSON is rejected with status 400',
    request: { method: 'POST', path: '/items', headers: jsonHeaders, body: '{"name":' },
    expectedStatus: 400,
    expectedResult: 'Status code is 400',
    verify: verifyNoStatusCheck
  },
  {
    suite: 'POST /items',
    type: 'edgeCase',
    severity: 'normal',
    title: 'Malformed JSON error is returned as JSON',
    request: { method: 'POST', path: '/items', headers: jsonHeaders, body: '{"name":' },
    expectedStatus: 400,
    expectedResult: 'Content type is application/json and body contains an error message',
    verify: (response) => verifyJsonContentType(response) || verifyErrorMessagePresent(response)
  },
  {
    suite: 'GET /items',
    type: 'dataIntegrity',
    severity: 'blocker',
    title: 'Rejected requests did not modify the stored items',
    request: { method: 'GET', path: '/items', headers: {}, body: undefined },
    expectedStatus: 200,
    expectedResult: 'List contains exactly the five items created by valid requests',
    verify: verifyJsonEquals([
      { id: 1, name: 'apple' },
      { id: 2, name: 'banana' },
      { id: 3, name: 'cherry' },
      { id: 4, name: 'date' },
      { id: 5, name: 'çilek 🍓' }
    ])
  },
  {
    suite: 'POST /items',
    type: 'security',
    severity: 'critical',
    title: 'Payload above the size limit is rejected',
    request: {
      method: 'POST',
      path: '/items',
      headers: jsonHeaders,
      body: JSON.stringify({ name: oversizedName }),
      bodyNote: 'JSON body {"name":"<204800 times the letter a>"}'
    },
    expectedStatus: 413,
    expectedResult: 'Status code is 413',
    verify: verifyNoStatusCheck
  },
  {
    suite: 'POST /items',
    type: 'security',
    severity: 'normal',
    title: 'Name longer than 100 characters is rejected',
    request: {
      method: 'POST',
      path: '/items',
      headers: jsonHeaders,
      body: JSON.stringify({ name: longName })
    },
    expectedStatus: 400,
    expectedResult: 'Response contains a JSON error message',
    verify: verifyErrorMessagePresent
  },
  {
    suite: 'Server',
    type: 'security',
    severity: 'minor',
    title: 'Server technology header is not exposed',
    request: { method: 'GET', path: '/items', headers: {}, body: undefined },
    expectedStatus: 200,
    expectedResult: 'Response has no X-Powered-By header',
    verify: verifyPoweredByHeaderAbsent
  },
  {
    suite: 'Server',
    type: 'edgeCase',
    severity: 'minor',
    title: 'Unknown route returns 404',
    request: { method: 'GET', path: '/unknown', headers: {}, body: undefined },
    expectedStatus: 404,
    expectedResult: 'Status code is 404',
    verify: verifyNoStatusCheck
  },
  {
    suite: 'Server',
    type: 'edgeCase',
    severity: 'minor',
    title: 'Unsupported PUT method returns 404',
    request: { method: 'PUT', path: '/items', headers: jsonHeaders, body: '{"name":"apple"}' },
    expectedStatus: 404,
    expectedResult: 'Status code is 404',
    verify: verifyNoStatusCheck
  },
  {
    suite: 'Server',
    type: 'edgeCase',
    severity: 'minor',
    title: 'Unsupported DELETE method returns 404',
    request: { method: 'DELETE', path: '/items', headers: {}, body: undefined },
    expectedStatus: 404,
    expectedResult: 'Status code is 404',
    verify: verifyNoStatusCheck
  }
];

module.exports = scenarios.map((scenario, index) => ({
  ...scenario,
  id: `TC${String(index + 1).padStart(2, '0')}`
}));
