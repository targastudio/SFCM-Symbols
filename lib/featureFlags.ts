/**
 * Feature flags for the SFCM Symbol Generator.
 *
 * Real-Time Generation is guarded behind NEXT_PUBLIC_REAL_TIME_GENERATION so we
 * can stage the rollout without shipping multiple builds.
 *
 * - "enabled" / "true" / "on"  → feature forced ON
 * - "disabled" / "false" / "off" → feature forced OFF
 * - undefined / any other value → defaults to ON
 */
const realtimeEnv = process.env.NEXT_PUBLIC_REAL_TIME_GENERATION?.toLowerCase();
const realtimeExplicitlyEnabled = realtimeEnv === "enabled" || realtimeEnv === "true" || realtimeEnv === "on";
const realtimeExplicitlyDisabled = realtimeEnv === "disabled" || realtimeEnv === "false" || realtimeEnv === "off";
const realtimeEnvMissing = !realtimeEnv;

/**
 * Set to true when the Real-Time Generation controls should be available.
 * Defaults to true so the feature is active unless explicitly disabled.
 */
export const REAL_TIME_GENERATION_FLAG = realtimeExplicitlyDisabled
  ? false
  : realtimeExplicitlyEnabled || realtimeEnvMissing;
