export interface OutputDTO {
  address: string;
  value: number;
}

export interface InputDTO {
  txId: string;
  index: number;
}

export interface TransactionDTO {
  id: string;
  inputs: InputDTO[];
  outputs: OutputDTO[];
}

export interface BlockDTO {
  id: string;
  height: number;
  transactions: TransactionDTO[];
}

export const validateBlockDTO = (block: BlockDTO): string | null => {
  const transactionIds = new Set<string>();

  for (const tx of block.transactions) {
    // Check for duplicate transaction IDs
    if (transactionIds.has(tx.id)) {
      return `Duplicate transaction ID ${tx.id} found in block`;
    }
    transactionIds.add(tx.id);

    for (const output of tx.outputs) {
      if (output.value <= 0) {
        return `Transaction ${tx.id} has an output with a non-positive value: ${output.value}`;
      }

      // Check for invalid or missing addresses
      if (!output.address || typeof output.address !== 'string') {
        return `Transaction ${tx.id} has an invalid or missing address`;
      }
    }

    for (const input of tx.inputs) {
      if (!input.txId || input.index < 0) {
        return `Transaction ${tx.id} has an invalid input referencing txId ${input.txId} with index ${input.index}`;
      }
    }
  }

  return null; 
};
