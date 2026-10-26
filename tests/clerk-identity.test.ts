import { describe, expect, test } from 'bun:test'
import {
  baseUsernameFromEmail,
  clerkIdentityFromUser,
  clerkIdentityFromWebhookUser,
  displayNameFromClerk,
  usernameCandidate,
  verifiedEmailFromClerk,
  type ClerkUserLike,
} from '../src/lib/clerk-identity'

function user(overrides: Partial<ClerkUserLike> = {}): ClerkUserLike {
  return {
    id: 'user_clerk_1',
    primaryEmailAddressId: 'email_1',
    emailAddresses: [
      { id: 'email_1', emailAddress: 'Owner@Example.com', verification: { status: 'verified' } },
    ],
    firstName: 'Akash',
    lastName: 'Gupta',
    username: null,
    ...overrides,
  }
}

describe('Clerk identity mapping', () => {
  test('uses the primary verified email and normalizes case', () => {
    expect(verifiedEmailFromClerk(user())).toBe('owner@example.com')
  })

  test('falls back to another verified email when the primary is unverified', () => {
    expect(
      verifiedEmailFromClerk(
        user({
          emailAddresses: [
            { id: 'email_1', emailAddress: 'unverified@example.com', verification: { status: 'unverified' } },
            { id: 'email_2', emailAddress: 'verified@example.com', verification: { status: 'verified' } },
          ],
        }),
      ),
    ).toBe('verified@example.com')
  })

  test('never links an unverified email', () => {
    expect(
      verifiedEmailFromClerk(
        user({
          emailAddresses: [
            { id: 'email_1', emailAddress: 'unverified@example.com', verification: { status: 'unverified' } },
          ],
        }),
      ),
    ).toBeNull()
  })

  test('derives a valid SAP-style user name from an email local part', () => {
    expect(baseUsernameFromEmail('akash.gupta@example.com')).toBe('AKASHGUPTA')
    expect(baseUsernameFromEmail('1akash@example.com')).toBe('U1AKASH')
    expect(baseUsernameFromEmail('ab@example.com')).toBe('ABUSER')
    expect(baseUsernameFromEmail('a-very-long-local-part-name@example.com').length).toBeLessThanOrEqual(20)
  })

  test('collision suffixes stay within the SAP 20-character limit', () => {
    const base = 'ABCDEFGHIJKLMNOPQRST'
    expect(usernameCandidate(base, 0)).toBe('ABCDEFGHIJKLMNOPQRST')
    expect(usernameCandidate(base, 1).length).toBeLessThanOrEqual(20)
    expect(usernameCandidate(base, 1)).not.toBe(base)
  })

  test('builds a display identity from verified Clerk data', () => {
    expect(clerkIdentityFromUser(user())).toEqual({
      id: 'user_clerk_1',
      email: 'owner@example.com',
      displayName: 'Akash Gupta',
    })
    expect(displayNameFromClerk(user({ firstName: null, lastName: null, username: 'akash' }), 'fallback')).toBe('akash')
  })

  test('normalizes Clerk webhook snake_case payloads', () => {
    expect(
      clerkIdentityFromWebhookUser({
        id: 'user_webhook_1',
        primary_email_address_id: 'email_1',
        email_addresses: [
          {
            id: 'email_1',
            email_address: 'Webhook@Example.com',
            verification: { status: 'verified' },
          },
        ],
        first_name: 'Web',
        last_name: 'Hook',
        username: null,
      }),
    ).toEqual({
      id: 'user_webhook_1',
      email: 'webhook@example.com',
      displayName: 'Web Hook',
    })
  })
})
