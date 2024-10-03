# EMURGO Backend Engineer Challenge

This challenge is designed to evaluate your skills with data processing and API development. You will be responsible for creating an indexer that will keep track of the balance of each address in a blockchain.

Please read all instructions bellow carefully.

## Instructions
Fork this repository and make the necessary changes to complete the challenge. Once you are done, simply send your repository link to us and we will review it.

## Setup
This coding challenge uses [Bun](https://bun.sh/) as its runtime. If you are unfamiliar with it, you can follow the instructions on the official website to install it - it works pretty much the same as NodeJS, but has a ton of features that make our life easier, like a built-in test engine and TypeScript compiler.

Strictly speaking, because we run this project on Docker, you don't even need to have Bun installed on your machine. You can run the project using the `docker-compose` command, as described below.

The setup for this coding challenge is quite simple. You need to have `docker` and `docker-compose` installed on your machine. If you don't have them installed, you can follow the instructions on the official docker website to install them.

https://docs.docker.com/engine/install/
https://docs.docker.com/compose/install/

Once you have `docker` and `docker-compose` installed, you can run the following command to start the application:

```bash
docker-compose up -d --build
```

or using `Bun`

```bash
bun run-docker
```

## The Challenge
Your job is to create an indexer that will keep track of the current balance for each address. To do that, you will need to implement the following endpoints:

### `POST /blocks`
This endpoint will receive a JSON object that should match the `Block` type from the following schema:

```ts
Output = {
  address: string;
  value: number;
}

Input = {
  txId: string;
  index: number;
}

Transaction = {
  id: string;
  inputs: Array<Input>
  outputs: Array<Output>
}

Block = {
  id: string;
  height: number;
  transactions: Array<Transaction>;
}
```

Based on the received message you should update the balance of each address accordingly. This endpoint should also run the following validations:
- validate if the `height` is exactly one unit higher than the current height - this also means that the first ever block should have `height = 1`. If it is not, you should return a `400` status code with an appropriate message;
- validate if the sum of the values of the inputs is exactly equal to the sum of the values of the outputs. If it is not, you should return a `400` status code with an appropriate message;
- validate if the `id` of the Block correct. For that, the `id` of the block must be the sha256 hash of the sum of its transaction's ids together with its own height. In other words: `sha256(height + transaction1.id + transaction2.id + ... + transactionN.id)`. If it is not, you should return a `400` status code with an appropriate message;

#### Understanding the Schema
If you are familiar with the UTXO model, you will recognize the schema above. If you are not, here is a brief explanation:
- each transaction is composed of inputs and outputs;
- each input is a reference to an output of a previous transaction;
- each output means a given address **received** a certain amount of value;
- from the above, it follows that each input **spends** a certain amount of value from its original address;
- in summary, the balance of an address is the sum of all the values it received minus the sum of all the values it spent;

### `GET /balance/:address`
This endpoint should return the current balance of the given address. Simple as that.

### `POST /rollback?height=number`
This endpoint should rollback the state of the indexer to the given height. This means that you should undo all the transactions that were added after the given height and recalculate the balance of each address. You can assume the `height` will **never** be more than 2000 blocks from the current height.

## Example
Imagine the following sequence of messages:
```json
{
  height: 1,
  transactions: [{
    id: "tx1",
    inputs: [],
    outputs: [{
      address: "addr1",
      value: 10
    }]
  }]
}
// here we have addr1 with a balance of 10

{
  height: 2,
  transactions: [{
    id: "tx2",
    inputs: [{
      txId: "tx1",
      index: 0
    }],
    outputs: [{
      address: "addr2",
      value: 4
    }, {
      address: "addr3",
      value: 6
    }]
  }]
}
// here we have addr1 with a balance of 0, addr2 with a balance of 4 and addr3 with a balance of 6

{
  height: 3,
  transactions: [{
    id: "tx3",
    inputs: [{
      txId: "tx2",
      index: 1
    }],
    outputs: [{
      address: "addr4",
      value: 2
    }, {
      address: "addr5",
      value: 2
    }, {
      address: "addr6",
      value: 2
    }]
  }]
}
// here we have addr1 with a balance of 0, addr2 with a balance of 4, addr3 with a balance of 0 and addr4, addr5 and addr6 with a balance of 2
```

Then, if you receive the request `POST /rollback?height=2`, you should undo the last transaction which will lead to the state where we have addr1 with a balance of 0, addr2 with a balance of 4 and addr3 with a balance of 6.

## Tests
You should write tests for all the operations described above. Anything you put on the `spec` folder in the format `*.spec.ts` will be run by the test engine.

Here we are evaluating your capacity to understand what should be tested and how. Are you going to create abstractions and mock dependencies? Are you going to test the database layer? Are you going to test the API layer? That's all up to you.

## ReadME Updated 2nd October:
## Blockchain Indexer Submission Shub

This indexer is created to keep track of the current balances for each address. It uses Fastify for the API layer and keeps an in-memory blockchain for simplicity. I focused more on covering the core functionality of the indexer (covering all the edge cases) and unit tests of endpoints. The indexer supports adding blocks, rolling back the blockchain, and querying balances of addresses. The API ensures validation for block structure, transaction input/output consistency, and prevents negative balances.

## Focused Areas

### 1. Track Balances
Maintain the balance of each address by processing blocks and transactions.

### 2. Blockchain Validation
The indexer performs the following checks:
- Block height must be exactly one unit higher than the last.
- The sum of transaction inputs must match the sum of outputs.
- The block ID must be valid, calculated as the SHA-256 hash of its height and transaction IDs.
- Outputs with non-positive values are not allowed.

### 3. Rollback Mechanism
The blockchain can be rolled back to a specific height.

### 4. Edge Case Handling
Prevents negative balances, duplicate transaction IDs, and references to non-existent previous transactions.

## Endpoints

### 1. POST /v1/blocks
Adds a new block to the blockchain.

**Payload:**

```json
{
  "id": "d1582b9e2cac15e170c39ef2e85855ffd7e6a820550a8ca16a2f016d366503dc",
  "height": 1,
  "transactions": [
    {
      "id": "tx1",
      "inputs": [],
      "outputs": [
        {
          "address": "addr1",
          "value": 10
        }
      ]
    }
  ]
},
{
   "id":"c4701d0bfd7179e1db6e33e947e6c718bbc4a1ae927300cd1e3bda91a930cba5",
   "height":2,
   "transactions":[
      {
         "id":"tx2",
         "inputs":[
            {
               "txId":"tx1",
               "index":0
            }
         ],
         "outputs":[
            {
               "address":"addr2",
               "value":5
            },
            {
               "address":"addr1",
               "value":5
            }
         ]
      }
   ]
},
{
   "id":"4e5f22a2abacfaf2dcaaeb1652aec4eb65028d0f831fa435e6b1ee931c6799ec",
   "height":3,
   "transactions":[
      {
         "id":"tx3",
         "inputs":[
            {
               "txId":"tx2",
               "index":0
            }
         ],
         "outputs":[
            {
               "address":"addr3",
               "value":3
            },
            {
               "address":"addr2",
               "value":2
            }
         ]
      }
   ]
}

```
### 2. GET /v1/balance/
Fetches the balance of a given address.

**Example Request:**

```bash
GET /v1/balance/addr1
```

## Testing
I have used Postman for testing the API endpoints. The Postman collection is also attached in the repository.


## Run Tests
To run the unit tests, use the following command:
`npm test`


## Further Improvements
- Use PostgreSQL instead of an in-memory database to persist blockchain data. Implement database indexing on frequently queried fields (e.g., addresses, transaction IDs) and use caching strategies to reduce database load as the blockchain grows.
- Also,use thread-safe updates to the blockchain when handling concurrent block submissions by using PostgreSQL's transaction isolation levels. Use database transactions to implement atomic updates and support rollback.(for consistent data).
- Add more unit tests and maybe cover more indexer functioanlity to make it a robust solution.
