import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },    // Scenario 1: Typical SRE query
    { duration: '1m', target: 100 },    // Scenario 2: Active Audit Review
    { duration: '1m', target: 1000 },   // Scenario 3: Extreme Stress Scenario
    { duration: '30s', target: 0 },     // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<150'],  // 95% of requests must finish within 150ms
    http_req_failed: ['rate<0.01'],    // Error rate must be less than 1%
  },
};

export default function () {
  const BASE_URL = 'http://localhost:3000';

  // 1. Fetch active runbooks
  const runbooksRes = http.get(`${BASE_URL}/api/runbooks`);
  check(runbooksRes, {
    'status is 200': (r) => r.status === 200,
    'body contains Enterprise DB': (r) => r.body.includes('Enterprise Database'),
  });

  sleep(1);

  // 2. Fetch system metrics (Prometheus scraping simulation)
  const metricsRes = http.get(`${BASE_URL}/api/system/metrics`);
  check(metricsRes, {
    'status is 200': (r) => r.status === 200,
    'contains agent timings': (r) => r.body.includes('agentExecutionTimeAvg'),
  });

  sleep(1);
}
