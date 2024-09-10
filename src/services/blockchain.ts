import { Pool } from "pg";
import { createHash } from "crypto";
import { increaseBalance, decreaseBalance } from "./balances";

export async function validateBlock(block: any, pool: Pool) {
  const { height, transactions } = block;

  const currentHeightResult = await pool.query(
    "SELECT MAX(height) AS max FROM blocks"
  );
  const currentHeight = currentHeightResult.rows[0].max || 0;
  if (height !== currentHeight + 1) {
    throw new Error(
      `Invalid block height: expected ${currentHeight + 1}, got ${height}`
    );
  }

  if (height === 1) {
    return;
  }

  let inputSum = 0;
  let outputSum = 0;

  for (const tx of transactions) {
    for (const input of tx.inputs) {
      const result = await pool.query(
        "SELECT value FROM outputs WHERE tx_id = $1 AND id = $2",
        [input.txId, input.index]
      );
      if (result.rows.length === 0) {
        throw new Error(`Input not found for transaction ${tx.id}`);
      }
      inputSum += result.rows[0].value;
    }

    for (const output of tx.outputs) {
      outputSum += output.value;
    }
  }

  if (inputSum !== outputSum) {
    throw new Error(
      `Invalid transaction: inputs (${inputSum}) do not match outputs (${outputSum})`
    );
  }

  const txIds = transactions.map((tx: any) => tx.id).join("");
  const expectedHash = createHash("sha256")
    .update(`${height}${txIds}`)
    .digest("hex");
  if (block.id !== expectedHash) {
    throw new Error("Invalid block ID: hash does not match");
  }
}

export async function processBlock(block: any, pool: Pool) {
  const { id, height, transactions } = block;

  await pool.query(
    "INSERT INTO blocks (id, height, block_hash) VALUES ($1, $2, $3)",
    [id, height, id]
  );

  for (const tx of transactions) {
    await pool.query(
      "INSERT INTO transactions (id, block_id, tx_id) VALUES ($1, $2, $3)",
      [tx.id, id, tx.id]
    );

    for (const output of tx.outputs) {
      await pool.query(
        "INSERT INTO outputs (tx_id, address, value) VALUES ($1, $2, $3)",
        [tx.id, output.address, output.value]
      );

      await increaseBalance(output.address, output.value, pool);
    }

    for (const input of tx.inputs) {
      const outputResult = await pool.query(
        "SELECT value, address FROM outputs WHERE tx_id = $1 AND id = $2",
        [input.txId, input.index]
      );

      if (outputResult.rows.length === 0) {
        throw new Error(`Invalid input reference for transaction ${tx.id}`);
      }

      const spentValue = outputResult.rows[0].value;
      const senderAddress = outputResult.rows[0].address;

      await decreaseBalance(senderAddress, spentValue, pool);
    }
  }
}

export async function rollbackBlocks(targetHeight: number, pool: Pool) {
  const blocksToRemove = await pool.query(
    "SELECT id FROM blocks WHERE height > $1",
    [targetHeight]
  );

  if (blocksToRemove.rows.length === 0) {
    throw new Error(`No blocks to rollback past height ${targetHeight}`);
  }

  for (const block of blocksToRemove.rows) {
    const transactionsToRemove = await pool.query(
      "SELECT id FROM transactions WHERE block_id = $1",
      [block.id]
    );

    for (const tx of transactionsToRemove.rows) {
      const outputsToRevert = await pool.query(
        "SELECT address, value FROM outputs WHERE tx_id = $1",
        [tx.id]
      );
      for (const output of outputsToRevert.rows) {
        await decreaseBalance(output.address, output.value, pool);
      }

      const inputsToRevert = await pool.query(
        "SELECT output_tx_id, output_index FROM inputs WHERE tx_id = $1",
        [tx.id]
      );
      for (const input of inputsToRevert.rows) {
        const originalOutput = await pool.query(
          "SELECT value, address FROM outputs WHERE tx_id = $1 AND id = $2",
          [input.output_tx_id, input.output_index]
        );
        await increaseBalance(
          originalOutput.rows[0].address,
          originalOutput.rows[0].value,
          pool
        );
      }

      await pool.query("DELETE FROM outputs WHERE tx_id = $1", [tx.id]);
      await pool.query("DELETE FROM inputs WHERE tx_id = $1", [tx.id]);
    }

    await pool.query("DELETE FROM transactions WHERE block_id = $1", [
      block.id,
    ]);
    await pool.query("DELETE FROM blocks WHERE id = $1", [block.id]);
  }
}
