// Clerk owns the interactive identity form; these tokens keep its card inside
// the manifest coupon instead of introducing a second visual system.
export const clerkAppearance = {
  variables: {
    colorPrimary: '#0a6ed1',
    colorBackground: '#ffffff',
    colorText: '#16283b',
    colorTextSecondary: '#5b6b7c',
    colorInputBackground: '#f4f7fa',
    colorInputText: '#16283b',
    colorDanger: '#c0392b',
    colorSuccess: '#2ea52e',
    colorWarning: '#b0600b',
    fontFamily: 'var(--font-archivo), "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    borderRadius: '0px',
    fontSize: '14px',
  },
  elements: {
    card: 'shadow-none border-0 bg-transparent',
    headerTitle: 'text-[#16283b]',
    headerSubtitle: 'text-[#5b6b7c]',
  },
}
