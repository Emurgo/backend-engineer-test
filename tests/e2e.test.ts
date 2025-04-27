import { describe, it, beforeAll, afterAll, expect, vi, test } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

//
import Migrations from '../src/migrations/migration';
import routes from '../src/routes/v1.route'; // Your routes file
import * as DbClient from '../src/utilities/database/client';

import { testSuccessData } from './testData';

describe ('E2E Tests', () => {
  //
  let app: FastifyInstance;

  //
  const testDbUrl = `postgres://myuser:mypassword@localhost:5432`;
  let testDBName = '';

  //
  beforeAll(async () => {
    //
    app = Fastify();
    app.register(routes);
    await app.ready();

    // setup database connection
    testDBName = `e2e_test_db_${randomUUID().substring(0, 6)}`;
    await DbClient.init(testDbUrl, testDBName);
    await Migrations.run();

    process.env.DATABASE_URL = testDbUrl;
    process.env.DB_NAME = testDBName;
  });

  //
  afterAll(async () => {
    // terminate all connections to the test database
    const pool = DbClient.get();
    await pool.end();

    // Use the default database for dropping
    const defaultPool = new Pool({
      connectionString: `${testDbUrl}/postgres`,
    });

    await defaultPool.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${testDBName}'
        AND pid <> pg_backend_pid();
    `);

    await defaultPool.query('DROP TABLE IF EXISTS blocks, transactions, inputs, outputs, ledgers;');
    await defaultPool.query(`DROP DATABASE IF EXISTS ${testDBName};`);
    await defaultPool.end();

    //
    await app.close();
  });

  //
  describe("Simulation - Create -> Rollback -> Create", () => {
    //
    it('1. POST /blocks creates initial block, credit to address 0', async () => {
      //
      const res = await app.inject({
        method: 'POST',
        url: '/blocks',
        payload: testSuccessData[0],
      });
      expect(res.statusCode).toBe(200);
    });

    //
    it('2. GET /balance from the address0', async () => {
      //
      const res = await app.inject({
        method: 'GET',
        url: `/balance/address0`,
      });
      const json = res.json();
      expect(res.statusCode).toBe(200);
      expect(json.balance).toEqual(50);
    });

    //
    it('3. POST /blocks, [credit address1] | [debit address2, credit address2, credit address3] | [debit address1, credit address1, credit address 3]', async () => {
      //
      const res = await app.inject({
        method: 'POST',
        url: '/blocks',
        payload: testSuccessData[1],
      });
      expect(res.statusCode).toBe(200);
    });

    //
    it('4. GET /balance of address1', async () => {
      //
      const res = await app.inject({
        method: 'GET',
        url: `/balance/address1`,
      });
      const json = res.json();
      expect(res.statusCode).toBe(200);
      expect(json.balance).toEqual(0);
    });

    //
    it('5. GET /balance of address2', async () => {
      //
      const res = await app.inject({
        method: 'GET',
        url: `/balance/address2`,
      });
      const json = res.json();
      expect(res.statusCode).toBe(200);
      expect(json.balance).toEqual(10);
    });

    //
    it('6. POST /blocks, [credit address1] | [debit address1, credit address2]', async () => {
      //
      const res = await app.inject({
        method: 'POST',
        url: '/blocks',
        payload: testSuccessData[2],
      });
      expect(res.statusCode).toBe(200);
    });

    //
    it('7. GET /balance of address1', async () => {
      //
      const res = await app.inject({
        method: 'GET',
        url: `/balance/address1`,
      });
      const json = res.json();
      expect(res.statusCode).toBe(200);
      expect(json.balance).toEqual(8);
    });

    //
    it('8. GET /balance of address2', async () => {
      //
      const res = await app.inject({
        method: 'GET',
        url: `/balance/address2`,
      });
      const json = res.json();
      expect(res.statusCode).toBe(200);
      expect(json.balance).toEqual(5);
    });

    //
    it('9. GET /balance of address3', async () => {
      //
      const res = await app.inject({
        method: 'GET',
        url: `/balance/address3`,
      });
      const json = res.json();
      expect(res.statusCode).toBe(200);
      expect(json.balance).toEqual(7);
    });

    //
    it('10. POST /blocks, [debit address3] | [credit address3, credit address4]', async () => {
      //
      const res = await app.inject({
        method: 'POST',
        url: '/blocks',
        payload: testSuccessData[3],
      });
      expect(res.statusCode).toBe(200);
    });

    //
    it('11. GET /balance of address1', async () => {
      //
      const res = await app.inject({
        method: 'GET',
        url: `/balance/address1`,
      });
      const json = res.json();
      expect(res.statusCode).toBe(200);
      expect(json.balance).toEqual(8);
    });

    //
    it('12. GET /balance of address2', async () => {
      //
      const res = await app.inject({
        method: 'GET',
        url: `/balance/address2`,
      });
      const json = res.json();
      expect(res.statusCode).toBe(200);
      expect(json.balance).toEqual(5);
    });

    //
    it('13. GET /balance of address3', async () => {
      //
      const res = await app.inject({
        method: 'GET',
        url: `/balance/address3`,
      });
      const json = res.json();
      expect(res.statusCode).toBe(200);
      expect(json.balance).toEqual(1);
    });

    //
    it('14. GET /balance of address4', async () => {
      //
      const res = await app.inject({
        method: 'GET',
        url: `/balance/address4`,
      });
      const json = res.json();
      expect(res.statusCode).toBe(200);
      expect(json.balance).toEqual(6);
    });

    //
    it('15. POST /rollback, rollback to height 1', async () => {
      //
      const res = await app.inject({
        method: 'POST',
        url: '/rollback?height=1',
      });
      expect(res.statusCode).toBe(200);
    });

    //
    it('16. GET /balance of address1', async () => {
      //
      const res = await app.inject({
        method: 'GET',
        url: `/balance/address1`,
      });
      const json = res.json();
      expect(res.statusCode).toBe(200);
      expect(json.balance).toEqual(0);
    });

    //
    it('17. GET /balance of address2', async () => {
      //
      const res = await app.inject({
        method: 'GET',
        url: `/balance/address2`,
      });
      const json = res.json();
      expect(res.statusCode).toBe(200);
      expect(json.balance).toEqual(10);
    });

    //
    it('18. POST /blocks, reprocess height2 with all the transactions starting from txn3', async () => {
      //
      const res = await app.inject({
        method: 'POST',
        url: '/blocks',
        payload: testSuccessData[4],
      });

      console.log(res.json());
      expect(res.statusCode).toBe(200);
    });

    //
    it('19. GET /balance of address1', async () => {
      //
      const res = await app.inject({
        method: 'GET',
        url: `/balance/address1`,
      });
      const json = res.json();
      expect(res.statusCode).toBe(200);
      expect(json.balance).toEqual(8);
    });

    //
    it('20. GET /balance of address2', async () => {
      //
      const res = await app.inject({
        method: 'GET',
        url: `/balance/address2`,
      });
      const json = res.json();
      expect(res.statusCode).toBe(200);
      expect(json.balance).toEqual(5);
    });

    //
    it('21. GET /balance of address3', async () => {
      //
      const res = await app.inject({
        method: 'GET',
        url: `/balance/address3`,
      });
      const json = res.json();
      expect(res.statusCode).toBe(200);
      expect(json.balance).toEqual(1);
    });

    //
    it('22. GET /balance of address4', async () => {
      //
      const res = await app.inject({
        method: 'GET',
        url: `/balance/address4`,
      });
      const json = res.json();
      expect(res.statusCode).toBe(200);
      expect(json.balance).toEqual(6);
    });

  });

  //
  describe("Validation", () => {
    //
    it('POST /blocks with empty payload', async () => {
      //
      const res = await app.inject({
        method: 'POST',
        url: '/blocks',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    //
    it('POST /blocks with invalid payload', async () => {
      //
      const res = await app.inject({
        method: 'POST',
        url: '/blocks',
        payload: {
          id: "txn1",
          inputs: "",
          outputs: [],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    //
    it('GET /balance with invalid address', async () => {
      //
      const res = await app.inject({
        method: 'GET',
        url: `/balance/invalid_address`,
      });
      expect(res.statusCode).toBe(400);
    });

    //
    it('GET /balance with empty address', async () => {
      //
      const res = await app.inject({
        method: 'GET',
        url: `/balance/`,
      });
      expect(res.statusCode).toBe(400);
    });

    //
    it ('POST /rollback? with missing query', async () => {
      //
      const res = await app.inject({
        method: 'POST',
        url: '/rollback?',
      });
      expect(res.statusCode).toBe(400);
    });

    //
    it ('POST /rollback? with invalid query', async () => {
      //
      const res = await app.inject({
        method: 'POST',
        url: '/rollback?height=invalid',
      });
      expect(res.statusCode).toBe(400);
    });

    //
    it ('POST /rollback? with invalid query', async () => {
      //
      const res = await app.inject({
        method: 'POST',
        url: '/rollback?height=100000',
      });
      expect(res.statusCode).toBe(400);
    });

    //
    it('POST to nonexist endpoint', async () => {
      //
      const res = await app.inject({
        method: 'POST',
        url: '/notexist',
        payload: {
          id: "txn1",
          inputs: [],
          outputs: [],
        },
      });
      expect(res.statusCode).toBe(404);
    });
  });

});
