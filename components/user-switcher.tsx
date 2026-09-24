/**
 * UserSwitcher — legacy shim.
 * The gateway-based account switcher (GatewaySwitcher) is the canonical
 * implementation. This file is kept to avoid broken imports from any
 * cached references, but it simply re-exports GatewaySwitcher.
 */
export { GatewaySwitcher as UserSwitcher } from "@/components/gateway-switcher";
