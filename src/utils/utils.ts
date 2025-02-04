import {
  decode,
  decodeString,
  encodeToString,
} from "https://deno.land/std@0.100.0/encoding/hex.ts";
import { C, Core } from "../core/mod.ts";
import {
  Address,
  AddressDetails,
  Assets,
  CertificateValidator,
  Credential,
  Datum,
  DatumHash,
  KeyHash,
  MintingPolicy,
  NativeScript,
  Network,
  PolicyId,
  PrivateKey,
  RewardAddress,
  Script,
  ScriptHash,
  Slot,
  SpendingValidator,
  Unit,
  UnixTime,
  UTxO,
  Validator,
  WithdrawalValidator,
} from "../types/mod.ts";
import { Lucid } from "../lucid/mod.ts";
import { generateMnemonic } from "../misc/bip39.ts";
import {
  DEFAULT_SLOT_LENGTH,
  slotToBeginUnixTime,
  unixTimeToEnclosingSlot,
  zeroTimeNetwork,
} from "../plutus/time.ts";

export class Utils {
  private lucid: Lucid;
  constructor(lucid: Lucid) {
    this.lucid = lucid;
  }

  validatorToAddress(
    validator: SpendingValidator,
    stakeCredential?: Credential,
  ): Address {
    const validatorHash = this.validatorToScriptHash(validator);
    if (stakeCredential) {
      return C.BaseAddress.new(
        networkToId(this.lucid.network),
        C.StakeCredential.from_scripthash(C.ScriptHash.from_hex(validatorHash)),
        stakeCredential.type === "Key"
          ? C.StakeCredential.from_keyhash(
            C.Ed25519KeyHash.from_hex(stakeCredential.hash),
          )
          : C.StakeCredential.from_scripthash(
            C.ScriptHash.from_hex(stakeCredential.hash),
          ),
      )
        .to_address()
        .to_bech32(undefined);
    } else {
      return C.EnterpriseAddress.new(
        networkToId(this.lucid.network),
        C.StakeCredential.from_scripthash(C.ScriptHash.from_hex(validatorHash)),
      )
        .to_address()
        .to_bech32(undefined);
    }
  }

  credentialToAddress(
    paymentCredential: Credential,
    stakeCredential?: Credential,
  ): Address {
    if (stakeCredential) {
      return C.BaseAddress.new(
        networkToId(this.lucid.network),
        paymentCredential.type === "Key"
          ? C.StakeCredential.from_keyhash(
            C.Ed25519KeyHash.from_hex(paymentCredential.hash),
          )
          : C.StakeCredential.from_scripthash(
            C.ScriptHash.from_hex(paymentCredential.hash),
          ),
        stakeCredential.type === "Key"
          ? C.StakeCredential.from_keyhash(
            C.Ed25519KeyHash.from_hex(stakeCredential.hash),
          )
          : C.StakeCredential.from_scripthash(
            C.ScriptHash.from_hex(stakeCredential.hash),
          ),
      )
        .to_address()
        .to_bech32(undefined);
    } else {
      return C.EnterpriseAddress.new(
        networkToId(this.lucid.network),
        paymentCredential.type === "Key"
          ? C.StakeCredential.from_keyhash(
            C.Ed25519KeyHash.from_hex(paymentCredential.hash),
          )
          : C.StakeCredential.from_scripthash(
            C.ScriptHash.from_hex(paymentCredential.hash),
          ),
      )
        .to_address()
        .to_bech32(undefined);
    }
  }

  validatorToRewardAddress(
    validator: CertificateValidator | WithdrawalValidator,
  ): RewardAddress {
    const validatorHash = this.validatorToScriptHash(validator);
    return C.RewardAddress.new(
      networkToId(this.lucid.network),
      C.StakeCredential.from_scripthash(C.ScriptHash.from_hex(validatorHash)),
    )
      .to_address()
      .to_bech32(undefined);
  }

  credentialToRewardAddress(stakeCredential: Credential): RewardAddress {
    return C.RewardAddress.new(
      networkToId(this.lucid.network),
      stakeCredential.type === "Key"
        ? C.StakeCredential.from_keyhash(
          C.Ed25519KeyHash.from_hex(stakeCredential.hash),
        )
        : C.StakeCredential.from_scripthash(
          C.ScriptHash.from_hex(stakeCredential.hash),
        ),
    )
      .to_address()
      .to_bech32(undefined);
  }

  validatorToScriptHash(validator: Validator): ScriptHash {
    if (validator.type === "Native") {
      return C.NativeScript.from_bytes(fromHex(validator.script))
        .hash(C.ScriptHashNamespace.NativeScript)
        .to_hex();
    } else if (validator.type === "PlutusV1") {
      return C.PlutusScript.from_bytes(fromHex(validator.script))
        .hash(C.ScriptHashNamespace.PlutusV1)
        .to_hex();
    } else if (validator.type === "PlutusV2") {
      return C.PlutusScript.from_bytes(fromHex(validator.script))
        .hash(C.ScriptHashNamespace.PlutusV2)
        .to_hex();
    }
    throw new Error("No variant matched");
  }

  mintingPolicyToId(mintingPolicy: MintingPolicy): PolicyId {
    return this.validatorToScriptHash(mintingPolicy);
  }

  datumToHash(datum: Datum): DatumHash {
    return C.hash_plutus_data(C.PlutusData.from_bytes(fromHex(datum))).to_hex();
  }

  scriptHashToCredential(scriptHash: ScriptHash): Credential {
    return {
      type: "Script",
      hash: scriptHash,
    };
  }

  keyHashToCredential(keyHash: KeyHash): Credential {
    return {
      type: "Key",
      hash: keyHash,
    };
  }

  generatePrivateKey(): PrivateKey {
    return C.PrivateKey.generate_ed25519().to_bech32();
  }

  generateSeedPhrase(): string {
    return generateMnemonic(256);
  }

  unixTimeToSlot(unixTime: UnixTime): Slot {
    return unixTimeToEnclosingSlot(unixTime, {
      slotLength: DEFAULT_SLOT_LENGTH,
      zeroTime: zeroTimeNetwork[this.lucid.network],
    });
  }

  slotToUnixTime(slot: Slot): UnixTime {
    return slotToBeginUnixTime(slot, {
      slotLength: DEFAULT_SLOT_LENGTH,
      zeroTime: zeroTimeNetwork[this.lucid.network],
    });
  }

  /** Address can be in Bech32 or Hex */
  getAddressDetails(address: string): AddressDetails {
    return getAddressDetails(address);
  }

  /**
   * Convert a native script from Json to the Hex representation.
   * It follows this Json format: https://github.com/input-output-hk/cardano-node/blob/master/doc/reference/simple-scripts.md
   */
  nativeScriptFromJson(nativeScript: NativeScript): Script {
    return nativeScriptFromJson(nativeScript);
  }
}

function addressFromHexOrBech32(address: string): Core.Address {
  try {
    return C.Address.from_bytes(fromHex(address));
  } catch (_e) {
    try {
      return C.Address.from_bech32(address);
    } catch (_e) {
      throw new Error("Could not deserialize address.");
    }
  }
}

/** Address can be in Bech32 or Hex */
export function getAddressDetails(address: string): AddressDetails {
  // Base Address
  try {
    const parsedAddress = C.BaseAddress.from_address(
      addressFromHexOrBech32(address),
    )!;
    const paymentCredential: Credential =
      parsedAddress.payment_cred().kind() === 0
        ? {
          type: "Key",
          hash: toHex(
            parsedAddress.payment_cred().to_keyhash()!.to_bytes(),
          ),
        }
        : {
          type: "Script",
          hash: toHex(
            parsedAddress.payment_cred().to_scripthash()!.to_bytes(),
          ),
        };
    const stakeCredential: Credential = parsedAddress.stake_cred().kind() === 0
      ? {
        type: "Key",
        hash: toHex(parsedAddress.stake_cred().to_keyhash()!.to_bytes()),
      }
      : {
        type: "Script",
        hash: toHex(
          parsedAddress.stake_cred().to_scripthash()!.to_bytes(),
        ),
      };
    return {
      type: "Base",
      networkId: parsedAddress.to_address().network_id(),
      address: {
        bech32: parsedAddress.to_address().to_bech32(undefined),
        hex: toHex(parsedAddress.to_address().to_bytes()),
      },
      paymentCredential,
      stakeCredential,
    };
  } catch (_e) { /* pass */ }

  // Enterprise Address
  try {
    const parsedAddress = C.EnterpriseAddress.from_address(
      addressFromHexOrBech32(address),
    )!;
    const paymentCredential: Credential =
      parsedAddress.payment_cred().kind() === 0
        ? {
          type: "Key",
          hash: toHex(
            parsedAddress.payment_cred().to_keyhash()!.to_bytes(),
          ),
        }
        : {
          type: "Script",
          hash: toHex(
            parsedAddress.payment_cred().to_scripthash()!.to_bytes(),
          ),
        };
    return {
      type: "Enterprise",
      networkId: parsedAddress.to_address().network_id(),
      address: {
        bech32: parsedAddress.to_address().to_bech32(undefined),
        hex: toHex(parsedAddress.to_address().to_bytes()),
      },
      paymentCredential,
    };
  } catch (_e) { /* pass */ }

  // Pointer Address
  try {
    const parsedAddress = C.PointerAddress.from_address(
      addressFromHexOrBech32(address),
    )!;
    const paymentCredential: Credential =
      parsedAddress.payment_cred().kind() === 0
        ? {
          type: "Key",
          hash: toHex(
            parsedAddress.payment_cred().to_keyhash()!.to_bytes(),
          ),
        }
        : {
          type: "Script",
          hash: toHex(
            parsedAddress.payment_cred().to_scripthash()!.to_bytes(),
          ),
        };
    return {
      type: "Pointer",
      networkId: parsedAddress.to_address().network_id(),
      address: {
        bech32: parsedAddress.to_address().to_bech32(undefined),
        hex: toHex(parsedAddress.to_address().to_bytes()),
      },
      paymentCredential,
    };
  } catch (_e) { /* pass */ }

  // Reward Address
  try {
    const parsedAddress = C.RewardAddress.from_address(
      addressFromHexOrBech32(address),
    )!;
    const stakeCredential: Credential =
      parsedAddress.payment_cred().kind() === 0
        ? {
          type: "Key",
          hash: toHex(
            parsedAddress.payment_cred().to_keyhash()!.to_bytes(),
          ),
        }
        : {
          type: "Script",
          hash: toHex(
            parsedAddress.payment_cred().to_scripthash()!.to_bytes(),
          ),
        };
    return {
      type: "Reward",
      networkId: parsedAddress.to_address().network_id(),
      address: {
        bech32: parsedAddress.to_address().to_bech32(undefined),
        hex: toHex(parsedAddress.to_address().to_bytes()),
      },
      stakeCredential,
    };
  } catch (_e) { /* pass */ }

  throw new Error("No address type matched for: " + address);
}

export function valueToAssets(value: Core.Value): Assets {
  const assets: Assets = {};
  assets["lovelace"] = BigInt(value.coin().to_str());
  const ma = value.multiasset();
  if (ma) {
    const multiAssets = ma.keys();
    for (let j = 0; j < multiAssets.len(); j++) {
      const policy = multiAssets.get(j);
      const policyAssets = ma.get(policy)!;
      const assetNames = policyAssets.keys();
      for (let k = 0; k < assetNames.len(); k++) {
        const policyAsset = assetNames.get(k);
        const quantity = policyAssets.get(policyAsset)!;
        const unit = toHex(policy.to_bytes()) + toHex(policyAsset.name());
        assets[unit] = BigInt(quantity.to_str());
      }
    }
  }
  return assets;
}

export function assetsToValue(assets: Assets): Core.Value {
  const multiAsset = C.MultiAsset.new();
  const lovelace = assets["lovelace"];
  const units = Object.keys(assets);
  const policies = Array.from(
    new Set(
      units
        .filter((unit) => unit !== "lovelace")
        .map((unit) => unit.slice(0, 56)),
    ),
  );
  policies.forEach((policy) => {
    const policyUnits = units.filter((unit) => unit.slice(0, 56) === policy);
    const assetsValue = C.Assets.new();
    policyUnits.forEach((unit) => {
      assetsValue.insert(
        C.AssetName.new(fromHex(unit.slice(56))),
        C.BigNum.from_str(assets[unit].toString()),
      );
    });
    multiAsset.insert(C.ScriptHash.from_bytes(fromHex(policy)), assetsValue);
  });
  const value = C.Value.new(
    C.BigNum.from_str(lovelace ? lovelace.toString() : "0"),
  );
  if (units.length > 1 || !lovelace) value.set_multiasset(multiAsset);
  return value;
}

export function utxoToCore(utxo: UTxO): Core.TransactionUnspentOutput {
  const address: Core.Address = (() => {
    try {
      return C.Address.from_bech32(utxo.address);
    } catch (_e) {
      return C.ByronAddress.from_base58(utxo.address).to_address();
    }
  })();
  const output = C.TransactionOutput.new(address, assetsToValue(utxo.assets));
  if (utxo.datumHash) {
    output.set_datum(
      C.Datum.new_data_hash(C.DataHash.from_bytes(fromHex(utxo.datumHash))),
    );
  }
  // inline datum
  if (!utxo.datumHash && utxo.datum) {
    output.set_datum(
      C.Datum.new_data(
        C.Data.new(C.PlutusData.from_bytes(fromHex(utxo.datum))),
      ),
    );
  }

  if (utxo.scriptRef) {
    output.set_script_ref(C.ScriptRef.from_bytes(fromHex(utxo.scriptRef)));
  }

  return C.TransactionUnspentOutput.new(
    C.TransactionInput.new(
      C.TransactionHash.from_bytes(fromHex(utxo.txHash)),
      C.BigNum.from_str(utxo.outputIndex.toString()),
    ),
    output,
  );
}

export function coreToUtxo(coreUtxo: Core.TransactionUnspentOutput): UTxO {
  return {
    txHash: toHex(coreUtxo.input().transaction_id().to_bytes()),
    outputIndex: parseInt(coreUtxo.input().index().to_str()),
    assets: valueToAssets(coreUtxo.output().amount()),
    address: coreUtxo.output().address().as_byron()
      ? coreUtxo.output().address().as_byron()?.to_base58()!
      : coreUtxo.output().address().to_bech32(undefined),
    datumHash: coreUtxo.output()?.datum()?.as_data_hash()?.to_hex(),
    datum: coreUtxo.output()?.datum()?.as_data() &&
      toHex(coreUtxo.output().datum()!.as_data()!.to_bytes()),
    scriptRef: coreUtxo.output()?.script_ref() &&
      toHex(coreUtxo.output().script_ref()!.to_bytes()),
  };
}

export function networkToId(network: Network): number {
  switch (network) {
    case "Testnet":
      return 0;
    case "Preview":
      return 0;
    case "Preprod":
      return 0;
    case "Mainnet":
      return 1;
    default:
      throw new Error("Network not found");
  }
}

export function fromHex(hex: string): Uint8Array {
  return decodeString(hex);
}

export function toHex(bytes: Uint8Array): string {
  return encodeToString(bytes);
}

export function hexToUtf8(hex: string): string {
  return new TextDecoder().decode(decode(new TextEncoder().encode(hex)));
}

export function utf8ToHex(utf8: string): string {
  return toHex(new TextEncoder().encode(utf8));
}

// WIP!! This is not finalized yet until CIP-0067 and CIP-0068 are merged

function checksum(num: number): string {
  return num.toString(16).split("").reduce(
    (acc, curr) => acc + parseInt(curr, 16),
    0x0,
  )
    .toString(16).padStart(2, "0");
}

export function toLabel(num: number): string {
  if (num < 0 || num > 65535) {
    throw new Error(
      `Label ${num} out of range: min label 0 - max label 65535.`,
    );
  }
  return "0" + num.toString(16).padStart(4, "0") + checksum(num) +
    "0";
}

export function fromLabel(label: string): number | null {
  if (label.length !== 8 || !(label[0] === "0" && label[7] === "0")) {
    return null;
  }
  const num = parseInt(label.slice(1, 5), 16);
  const check = label.slice(5, 7);
  return check === checksum(num) ? num : null;
}

/**
 * @param name UTF-8 encoded
 */
export function toUnit(
  policyId: PolicyId,
  name?: string | null,
  label?: number | null,
): Unit {
  const hexLabel = Number.isInteger(label) ? toLabel(label!) : "";
  const hexName = name ? toHex(new TextEncoder().encode(name)) : "";
  if ((hexName + hexLabel).length > 64) {
    throw new Error("Asset name size exceeds 32 bytes.");
  }
  if (policyId.length !== 56) {
    throw new Error(`Policy Id invalid: ${policyId}.`);
  }
  return policyId + hexLabel + hexName;
}

/**
 * Splits unit into policy id, name and label if applicable.
 * name will be returned in UTF-8 if possible, otherwise in Hex.
 */
export function fromUnit(
  unit: Unit,
): { policyId: PolicyId; name: string | null; label: number | null } {
  const policyId = unit.slice(0, 56);
  const label = fromLabel(unit.slice(56, 64));
  const name = (() => {
    const hexName = Number.isInteger(label) ? unit.slice(64) : unit.slice(56);
    if (!hexName) return null;
    try {
      return hexToUtf8(hexName);
    } catch (_e) {
      return hexName;
    }
  })();
  return { policyId, name, label };
}

/**
 * Convert a native script from Json to the Hex representation.
 * It follows this Json format: https://github.com/input-output-hk/cardano-node/blob/master/doc/reference/simple-scripts.md
 */
export function nativeScriptFromJson(nativeScript: NativeScript): Script {
  return {
    type: "Native",
    script: toHex(
      C.encode_json_str_to_native_script(
        JSON.stringify(nativeScript),
        "",
        C.ScriptSchema.Node,
      ).to_bytes(),
    ),
  };
}
