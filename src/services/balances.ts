import { Pool } from "pg";

export async function getBalance(address: string, pool: Pool) {
  const result = await pool.query(
    "SELECT balance FROM balances WHERE address = $1",
    [address]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].balance;
}

export async function increaseBalance(
  address: string,
  value: number,
  pool: Pool
): Promise<void> {
  await pool.query(
    `INSERT INTO balances (address, balance) 
     VALUES ($1, $2) 
     ON CONFLICT (address) DO 
     UPDATE SET balance = balances.balance + EXCLUDED.balance`,
    [address, value]
  );
}

export async function decreaseBalance(
  address: string,
  value: number,
  pool: Pool
): Promise<void> {
  const balanceResult = await pool.query(
    "SELECT balance FROM balances WHERE address = $1",
    [address]
  );

  if (balanceResult.rows.length === 0) {
    throw new Error(
      `Cannot decrease balance: Address ${address} does not exist.`
    );
  }

  const currentBalance = balanceResult.rows[0].balance;

  if (currentBalance < value) {
    throw new Error(
      `Insufficient balance: Address ${address} has only ${currentBalance} available.`
    );
  }

  await pool.query(
    `UPDATE balances 
     SET balance = balance - $1 
     WHERE address = $2`,
    [value, address]
  );
}
