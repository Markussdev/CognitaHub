import { Capacitor } from '@capacitor/core'
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor'

const API_KEY = import.meta.env.VITE_REVENUECAT_TEST_API_KEY
const ENTITLEMENT_ID = import.meta.env.VITE_REVENUECAT_ENTITLEMENT_ID || 'school_access'

let configured = false

// Serviço só da licença institucional (Cognita Escola) — nunca chamado pelo
// fluxo da criança. Ver services/supabase.js pra sessão anônima dela; os
// dois clientes ficam deliberadamente separados, sem se importar um pro
// outro.
export async function configureRevenueCat() {
  if (configured) return

  if (!Capacitor.isNativePlatform()) {
    throw new Error('REVENUECAT_NATIVE_ONLY')
  }

  if (!API_KEY) {
    throw new Error('REVENUECAT_API_KEY_MISSING')
  }

  await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG })
  await Purchases.configure({ apiKey: API_KEY })
  configured = true
}

export async function getSchoolOffering() {
  await configureRevenueCat()
  const offerings = await Purchases.getOfferings()
  return offerings.current
}

export async function getSchoolAccess() {
  await configureRevenueCat()
  const { customerInfo } = await Purchases.getCustomerInfo()
  return Boolean(customerInfo.entitlements.active[ENTITLEMENT_ID])
}

export async function purchaseSchoolPackage(aPackage) {
  await configureRevenueCat()
  const { customerInfo } = await Purchases.purchasePackage({ aPackage })
  return Boolean(customerInfo.entitlements.active[ENTITLEMENT_ID])
}
