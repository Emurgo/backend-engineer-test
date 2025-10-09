import { Pool } from 'pg';

export async function runSeeds(pool: Pool) {
  // Balance table seeding
  await pool.query(`DELETE FROM balances;`);

  const addresses = [
    'addr1g8krd7ruxm53julk40z6v5frywg4jxl0kj5mc8lu0gja5ek63aevsstjv6pfa2a245e9x0ay2u3egp8wgggtus3n7rryec97grd',
    'addr1quzds8wccl3a8hgr257ztyf9yysv3h82ve42y0j0m5the0ydqnx7guc7429chwy22q4vmaa9ttpkhzz0j6cpkyae42s30yrcmke',
    'addr1r07gfw2rask70wky59qlp6w7nfehny4ujspr8xlsk2te8jtwcsuqmcc56j4dhm7x92rpdlhq050fdzhdpemkn4yw4sgd4ex4uky',
  ];

  const balances = [23534.123426, 2352.191211, 454.002312];

  for (let i = 0; i < addresses.length; i++) {
    await pool.query(
      `INSERT INTO balances (address, balance) VALUES ($1, $2)`,
      [addresses[i], balances[i]]
    );
  }

  console.log('✅ Seeding completed');
}
