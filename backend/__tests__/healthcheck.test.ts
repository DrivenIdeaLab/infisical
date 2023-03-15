import { Server } from 'http';
import main from '../src';
import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import supertest from 'supertest';
import { setUpHealthEndpoint } from '../src/services/health';

let requestWithSupertest: supertest.SuperTest<supertest.Test>;
let server: Server;

describe('Healthcheck endpoint', () => {
  beforeAll(async () => {
    server = await main;
    requestWithSupertest = supertest(server);
    setUpHealthEndpoint(server);
  });
  afterAll(async () => {
    server.close();
  });

  it('GET /healthcheck should return OK', async () => {
    const res = await requestWithSupertest.get('/healthcheck');
    expect(res.status).toEqual(200);
  });
});