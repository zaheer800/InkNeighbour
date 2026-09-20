// Profile fields saved on the Supabase Auth user at sign-up.
//
// They show up as "Display name" in the Supabase dashboard's Authentication -> Users list and are
// readable from session.user.user_metadata. This is a convenience copy only: the `owners` table is
// the source of truth for name and phone, and user_metadata can be edited by the user themselves,
// so it must never be used for authorization or trusted for anything security-related.
export function signUpMetadata({ name, phone, provider_type, shop_name } = {}) {
  const clean = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  const fullName = clean(name)
  return Object.fromEntries(
    Object.entries({
      display_name: fullName,
      full_name: fullName,
      name: fullName,
      phone: clean(phone),
      provider_type: clean(provider_type),
      shop_name: clean(shop_name),
    }).filter(([, v]) => v !== undefined),
  )
}
