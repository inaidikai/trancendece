# Database Tables Guide - Quillow Auth Service

This guide explains each database table in simple language with real-world examples of how to test them.

---

## 1. **USERS Table** 👤

**What it does:** Stores information about every person who creates an account in Quillow.

**Imagine this:** When Liya registers for Quillow, her information gets saved here - her email, username, password (hashed/encrypted), and settings.

### What's stored in this table:

| Column | What it means | Example |
|--------|---------------|---------|
| `id` | Unique identifier for each user | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `email` | Email address (always lowercase) | `liya@example.com` |
| `username` | Display name chosen by user | `liya_stories` |
| `password_hash` | Encrypted version of password | `$2b$10$...` (never shows actual password) |
| `is_2fa_enabled` | Whether 2-factor authentication is on | `true` or `false` |
| `google_id` | ID if they signed up with Google | `123456789` or `NULL` if not used |
| `created_at` | When they registered | `2026-02-17 10:30:45` |
| `updated_at` | Last time their info was changed | `2026-02-17 14:20:10` |

### How to test it:

**Test Case 1: User Registration**
- ✅ Liya enters her email (`liya@example.com`), username (`liya_stories`), and password (`SecurePass123!`)
- ✅ Click "Register" button
- 🔍 **What you'll see in database:** A new row appears in `users` table with:
  - Her email (stored as lowercase)
  - Her username
  - Password hashed (you won't see `SecurePass123!`, it's encrypted)
  - `is_2fa_enabled = false` (she hasn't set up 2FA yet)
  - `google_id = NULL` (she didn't use Google to sign up)

**Test Case 2: User Login**
- ✅ Liya enters email and password to login
- 🔍 **What happens:** System finds her row in `users` table, checks if password matches, gives her a login token

**Test Case 3: Enable 2-Factor Authentication**
- ✅ Liya goes to settings and enables 2FA via email
- 🔍 **What changes:** Her row in `users` table gets updated:
  - `is_2fa_enabled = true`

---

## 2. **OAUTH_TOKENS Table** 🔐

**What it does:** Stores access tokens and refresh tokens for users who signed up with Google or connected Google account.

**Imagine this:** When Liya signs up using her Google account, we save special codes that let us access Google on her behalf. Think of it like a "ticket" that proves we have permission to use her Google account.

### What's stored in this table:

| Column | What it means | Example |
|--------|---------------|---------|
| `id` | Unique identifier for this token pair | `token_123` |
| `user_id` | Which user this token belongs to | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` (Liya's ID) |
| `provider` | Which service (always `google` for now) | `google` |
| `access_token` | Short-lived token to access Google | `ya29.a0AfH6SMBx...` (can expire) |
| `refresh_token` | Long-lived token to get new access tokens | `1//0gF...` (rarely expires) |
| `expires_at` | When access token expires | `2026-02-18 10:30:45` |
| `created_at` | When tokens were saved | `2026-02-17 09:00:00` |

### How to test it:

**Test Case 1: Google Sign-Up**
- ✅ Liya clicks "Sign up with Google"
- ✅ She logs into Google and approves access
- 🔍 **What you'll see in database:** A new row in `oauth_tokens` table:
  - `provider = google`
  - `access_token` = encrypted code from Google
  - `refresh_token` = long code to refresh when needed
  - `expires_at` = future date/time

**Test Case 2: Google Token Refresh**
- ✅ Liya uses the app days later
- ✅ System detects access token expired
- ✅ System uses refresh_token to get a new access_token from Google
- 🔍 **What changes:** Same row gets updated:
  - `access_token` = new code from Google
  - `expires_at` = new expiration date

---

## 3. **OAUTH_STATES Table** 🛡️

**What it does:** Temporary security codes used during Google sign-up to prevent hackers from pretending to be Liya.

**Imagine this:** When Liya clicks "Sign up with Google," we create a secret code and send it to Google. Google confirms the code matches before letting Liya proceed. It's like a password for just that one login attempt.

### What's stored in this table:

| Column | What it means | Example |
|--------|---------------|---------|
| `id` | Unique identifier | `state_456` |
| `state` | Secret code (long random string) | `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` |
| `provider` | Which service (always `google`) | `google` |
| `expires_at` | When this code stops being valid | `2026-02-17 10:35:45` (5 mins from creation) |
| `created_at` | When code was created | `2026-02-17 10:30:45` |

### How to test it:

**Test Case 1: Start Google Sign-Up**
- ✅ Liya clicks "Sign up with Google" button
- 🔍 **What you'll see in database:** A new row in `oauth_states` table:
  - `provider = google`
  - `state` = long random secret code
  - `expires_at` = 5 minutes from now
  - This code only exists while she's signing up

**Test Case 2: Successful Completion**
- ✅ Liya completes Google login
- ✅ Google confirms the state code matches
- 🔍 **What happens:** Row is deleted from `oauth_states` (it's no longer needed)

**Test Case 3: Timeout**
- ✅ Liya starts Google sign-up but leaves her phone
- ✅ 5 minutes pass without completing
- 🔍 **What happens:** Row automatically removed because `expires_at` was reached

---

## 4. **PASSWORD_RESET_TOKENS Table** 🔑

**What it does:** Special codes sent via email that let users reset forgotten passwords safely.

**Imagine this:** Liya forgets her password. She clicks "Forgot Password," gets an email with a link (containing a secret code), and can set a new password. This table stores those secret codes temporarily.

### What's stored in this table:

| Column | What it means | Example |
|--------|---------------|---------|
| `id` | Unique identifier | `reset_789` |
| `user_id` | Which user requested the reset | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` (Liya's ID) |
| `token` | Secret code in the reset link | `x9y8z7w6v5u4t3s2r1q0` |
| `expires_at` | When code stops working | `2026-02-17 12:30:45` (2 hours from now) |
| `created_at` | When code was created | `2026-02-17 10:30:45` |

### How to test it:

**Test Case 1: Request Password Reset**
- ✅ Liya clicks "Forgot Password"
- ✅ Enters her email
- ✅ Checks her email inbox
- 🔍 **What you'll see in database:** A new row in `password_reset_tokens` table:
  - `user_id` = Liya's ID
  - `token` = secret code in her email link
  - `expires_at` = 2 hours from now
  - Email link looks like: `quillow.com/reset-password?token=x9y8z7w6v5u4t3s2r1q0`

**Test Case 2: Reset Password Successfully**
- ✅ Liya clicks the link in her email
- ✅ Enters new password (`NewPass456!`)
- ✅ Password updated successfully
- 🔍 **What happens:** Row in `password_reset_tokens` is deleted (token is no longer valid)

**Test Case 3: Reset Link Timeout**
- ✅ Liya gets the reset email
- ✅ But waits 3 hours before clicking link
- ✅ Click link → "Link expired, request new one"
- 🔍 **Why:** `expires_at` has passed (token only valid for 2 hours)

---

## 5. **TWOFA_RECOVERY_CODES Table** 🆘

**What it does:** Backup codes given to users who enable 2-Factor Authentication in case they lose access to their email.

**Imagine this:** Liya enables 2FA (two-step login with email codes). She's given 8 backup codes to write down. If her email gets hacked or she can't access it, she can use these backup codes to still log in.

### What's stored in this table:

| Column | What it means | Example |
|--------|---------------|---------|
| `id` | Unique identifier for this code | `code_123` |
| `user_id` | Which user these codes belong to | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` (Liya's ID) |
| `code_hash` | Encrypted version of the backup code | `$2b$10$...` (never shows actual code) |
| `used_at` | When/if the code was used | `2026-02-18 09:15:22` or `NULL` if not used yet |
| `created_at` | When codes were generated | `2026-02-17 10:30:45` |

### How to test it:

**Test Case 1: Enable 2-Factor Authentication**
- ✅ Liya goes to Settings → Security
- ✅ Clicks "Enable 2-Factor Authentication"
- ✅ Confirms via email code
- ✅ Downloads 8 backup codes (like `AB-1234-5678`)
- 🔍 **What you'll see in database:** 8 new rows in `twofa_recovery_codes` table:
  - Each row has Liya's `user_id`
  - Each `code_hash` encrypted (won't see `AB-1234-5678`)
  - `used_at = NULL` (not used yet)

**Test Case 2: Use Backup Code**
- ✅ Liya can't access her email (forgot recovery password)
- ✅ At login, she selects "Use backup code" instead of email
- ✅ Enters one of her backup codes
- ✅ Successfully logs in
- 🔍 **What changes:** That code's row gets updated:
  - `used_at = 2026-02-18 09:15:22` (timestamp when used)
  - Can't be used again

**Test Case 3: Check Remaining Codes**
- ✅ Liya used 2 backup codes already
- ✅ Goes to Settings → View remaining backup codes
- 🔍 **What you'll see:** 6 codes still available (those with `used_at = NULL`)

---

## Quick Testing Summary Table 🎯

| Table | What triggers it | What to look for | When it clears |
|-------|-----------------|------------------|----------------|
| **users** | Registration / Google signup | New row with user info | Never (stays forever) |
| **oauth_tokens** | Google signup or connection | Tokens from Google | When user disconnects Google |
| **oauth_states** | Click "Sign up with Google" | Secret code appears | 5 minutes later or after completing signup |
| **password_reset_tokens** | Click "Forgot Password" | Reset token in email | 2 hours later or after successful reset |
| **twofa_recovery_codes** | Enable 2FA in settings | 8 backup codes | As user spends them (or set to "used") |

---

## Testing Order (Recommended) 📋

1. **Start with USERS** - Register a new user, see their row appear
2. **Then PASSWORD_RESET_TOKENS** - Request password reset, see token in database
3. **Then TWOFA_RECOVERY_CODES** - Enable 2FA, see 8 codes appear
4. **Then OAUTH_STATES** - Click Google signup, see temporary code
5. **Then OAUTH_TOKENS** - Complete Google signup, see access/refresh tokens

This order shows the progression from basic signup → security features → advanced features.

---

## Common Questions ❓

**Q: Why is password never visible?**
A: For security! Passwords are hashed (encrypted one-way). Even Quillow admins can't see them.

**Q: What if I see NULL in a column?**
A: NULL means "not applicable" or "not set yet". For example, `google_id = NULL` means user didn't sign up with Google.

**Q: Can I manually edit the database?**
A: You shouldn't! The app manages these tables. But for testing, you can view rows to verify they're being created correctly.

**Q: How long do rows stay in the database?**
A: Most forever (users, oauth_tokens). Some expire: oauth_states (5 min), password_reset_tokens (2 hours), twofa_recovery_codes (when used).
