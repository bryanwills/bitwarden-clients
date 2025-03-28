import { VendorId } from "@bitwarden/common/tools/extension";

import { AlgorithmsByType, Profile, Type } from "./data";

/** categorizes credentials according to their use-case outside of Bitwarden */
export type CredentialType = keyof typeof Type;

/** categorizes credentials according to their expected use-case within Bitwarden */
export type GeneratorProfile = keyof typeof Profile;

/** A type of password that may be generated by the credential generator. */
export type PasswordAlgorithm = (typeof AlgorithmsByType.password)[number];

/** A type of username that may be generated by the credential generator. */
export type UsernameAlgorithm = (typeof AlgorithmsByType.username)[number];

/** A type of email address that may be generated by the credential generator. */
export type EmailAlgorithm = (typeof AlgorithmsByType.email)[number] | ForwarderExtensionId;

/** Identifies a forwarding service */
export type ForwarderExtensionId = { forwarder: VendorId };

/** A type of credential that can be generated by the credential generator. */
// this is defined in terms of `AlgorithmsByType` to typecheck the keys of
// `AlgorithmsByType` against the keys of `CredentialType`.
export type CredentialAlgorithm =
  | (typeof AlgorithmsByType)[CredentialType][number]
  | ForwarderExtensionId;
