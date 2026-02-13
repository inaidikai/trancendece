# Backend Fixes - Priority Checklist
**Status:** Ready to implement  
**Total Time:** 8-12 hours  
**Difficulty:** Medium

---

## 🔴 CRITICAL FIXES (Do These First)

### ✅ Fix #1: Validate OAuth State Token
```
Priority:  🔴 CRITICAL
Impact:    CSRF vulnerability, state token ignored
Time:      1.5 hours
Files:     authController.js
Risk:      LOW (isolated changes)
Status:    [ ] NOT STARTED
```

**What to do:**
1. Add state storage cache (Map or Redis)
2. Store state when generating OAuth URL
3. Validate state in callback
4. Mark state as used (one-time)

**Code provided:** ✅ Yes (in QUICK_FIXES_GUIDE.md)

---

### ✅ Fix #2: Move Password Reset Tokens to Database
```
Priority:  🔴 CRITICAL
Impact:    Tokens lost on restart, not scalable
Time:      2 hours
Files:     passwordController.js, new migration
Risk:      MEDIUM (database change)
Status:    [ ] NOT STARTED
```

**What to do:**
1. Create migration `005_password_reset_tokens.sql`
2. Update forgotPassword() to save token to DB
3. Update resetPassword() to look up token from DB
4. Add token expiry and one-time-use checks

**Code provided:** ✅ Yes (in QUICK_FIXES_GUIDE.md)

---

### ✅ Fix #3: Add Password Policy to Reset
```
Priority:  🔴 CRITICAL
Impact:    Weak passwords allowed via reset
Time:      1 hour
Files:     passwordController.js
Risk:      LOW (just imports existing function)
Status:    [ ] NOT STARTED
```

**What to do:**
1. Import `validatePasswordPolicy` from utils/auth.js
2. Add validation before password reset
3. Return policy errors if password weak
4. Test with weak/strong passwords

**Code provided:** ✅ Yes (in QUICK_FIXES_GUIDE.md)

---

### ✅ Fix #4: Complete Friend Operations
```
Priority:  🔴 CRITICAL
Impact:    Feature incomplete (only 20% done)
Time:      2 hours
Files:     userController.js, authRoutes.js
Risk:      LOW (copy/paste pattern)
Status:    [ ] NOT STARTED
```

**What to do:**
1. Add `listFriends()` to userController.js
2. Add `getFriendRequests()` to userController.js
3. Add `acceptFriendRequest()` to userController.js
4. Add `rejectFriendRequest()` to userController.js
5. Add `removeFriend()` to userController.js
6. Add routes to authRoutes.js
7. Test each endpoint

**Code provided:** ✅ Yes (in QUICK_FIXES_GUIDE.md)

---

### ✅ Fix #5: Implement 2FA Recovery Codes
```
Priority:  🔴 CRITICAL
Impact:    Day 9 task not done
Time:      2 hours
Files:     twoFAController.js, new migration
Risk:      MEDIUM (database change)
Status:    [ ] NOT STARTED
```

**What to do:**
1. Create migration `004_recovery_codes.sql`
2. Add `generateRecoveryCodes()` function
3. Add `saveRecoveryCodes()` function
4. Update `enable2FA()` to generate codes
5. Add `useRecoveryCode()` endpoint
6. Test backup codes work

**Code provided:** ✅ Yes (in QUICK_FIXES_GUIDE.md)

---

## 🟡 HIGH PRIORITY (Do Next)

### ✅ Fix #6: Fix OAuth Tokens Table
```
Priority:  🟡 HIGH
Impact:    Can't have multiple OAuth providers
Time:      30 minutes
Files:     003_oauth_schema.sql
Risk:      MEDIUM (breaking change)
Status:    [ ] NOT STARTED
```

**Change:**
- Remove `UNIQUE` constraint on `user_id`
- Add `UNIQUE(user_id, provider)` instead
- Drop and recreate table

**Code provided:** ✅ Yes (in QUICK_FIXES_GUIDE.md)

---

### ✅ Fix #7: Add Default Avatar
```
Priority:  🟡 HIGH
Impact:    Users get null avatar
Time:      30 minutes
Files:     userController.js, authController.js
Risk:      LOW (just adds fallback)
Status:    [ ] NOT STARTED
```

**What to do:**
1. Use Gravatar or placeholder image URL
2. Apply to new user registration
3. Apply to OAuth signup
4. Test default appears when no avatar

**Code provided:** ✅ Yes (in QUICK_FIXES_GUIDE.md)

---

## 🟠 MEDIUM PRIORITY (Do After)

### ⏳ Fix #8: Implement user-service
```
Priority:  🟠 MEDIUM
Impact:    Service is just a stub
Time:      3 hours
Files:     user-service/index.js and related
Risk:      MEDIUM (new service)
Status:    [ ] NOT STARTED
```

**Scope:** TBD - depends on user-service responsibilities

---

### ⏳ Fix #9: Add Error Response Standardization
```
Priority:  🟠 MEDIUM
Impact:    Inconsistent error formats
Time:      1 hour
Files:     All controller files
Risk:      LOW (refactoring)
Status:    [ ] NOT STARTED
```

**Change all errors to:**
```javascript
{
  error: 'error_code',
  message: 'Human readable message',
  details: [] // optional
}
```

---

### ⏳ Fix #10: Commit to Async Pattern
```
Priority:  🟠 MEDIUM
Impact:    Mixed callbacks/async hard to maintain
Time:      2 hours
Files:     All controller files
Risk:      MEDIUM (refactoring)
Status:    [ ] NOT STARTED
```

**Change:** Convert all callbacks to async/await

---

## 🔵 BEFORE DEPLOYMENT

### ⏳ Add Test Suite
```
Priority:  🔵 ESSENTIAL
Impact:    0% test coverage
Time:      4 hours
Files:     tests/ (new directory)
Risk:      LOW (tests only)
Status:    [ ] NOT STARTED
```

**What to test:**
- Registration (valid/invalid inputs)
- Login (correct/wrong password)
- JWT validation
- 2FA flow
- Password reset
- Friends operations
- OAuth flow

---

### ⏳ Security Audit
```
Priority:  🔵 ESSENTIAL
Impact:    Production readiness
Time:      2 hours
Files:     All
Risk:      DETECTION ONLY
Status:    [ ] NOT STARTED
```

**Checklist:**
- [ ] No hardcoded secrets
- [ ] SQL injection prevention
- [ ] CSRF protection
- [ ] XSS prevention
- [ ] Rate limiting
- [ ] Input validation
- [ ] Error messages don't leak info

---

### ⏳ Docker & Deployment
```
Priority:  🔵 ESSENTIAL
Impact:    Services don't start correctly
Time:      1 hour
Files:     docker-compose.yml
Risk:      LOW (just config)
Status:    [ ] NOT STARTED
```

**Fix:**
- Add missing env vars to user-service
- Add missing env vars to diary-service
- Verify all services start
- Test API gateway routing

---

## 📋 WEEK 1 COMPLETION TRACKER

### Day Tasks (Week 1)
- [x] Day 1: Setup backend + user schema
- [x] Day 2: Register/login/hashing
- [x] Day 3: JWT + /me endpoint
- [ ] Day 4: Profile edit + default avatar ← Fix #7 needed
- [ ] Day 5: Friends system ← Fix #4 needed
- [ ] Day 6: Google OAuth ← Fix #1 needed
- [ ] Day 7: Basic testing ← Tests needed

**Score: 85%** (3 fixes needed for 100%)

---

## 📋 WEEK 2 COMPLETION TRACKER

### Day Tasks (Week 2)
- [ ] Day 8: 2FA enable/disable + OTP
- [ ] Day 9: 2FA recovery ← Fix #5 needed
- [ ] Day 10: Auth edge cases
- [ ] Days 11-14: Polish auth flows

**Score: 60%** (Recovery codes + polish needed)

---

## 🎯 IMPLEMENTATION PLAN

### Phase 1: Critical Fixes (1 Day)
Implement Fixes #1-5 in order:
1. Validate OAuth state (1.5h)
2. Move password tokens to DB (2h)
3. Add password policy to reset (1h)
4. Complete friend operations (2h)
5. Add recovery codes (2h)

**Total: 8.5 hours** → Can do in one focused day

### Phase 2: High Priority (4 hours)
Implement Fixes #6-7:
1. Fix oauth_tokens table (0.5h)
2. Add default avatar (0.5h)

**Total: 1 hour** → Quick wins

### Phase 3: Before Merge (6 hours)
1. Add test suite (4h)
2. Security audit (2h)

**Total: 6 hours** → Do before merging

### Phase 4: Polish (As time allows)
1. Error standardization (1h)
2. Async pattern refactor (2h)
3. Better logging (1h)

**Total: 4 hours** → Nice to have

---

## ✅ DAILY CHECKLIST

### Day 1: OAuth & Password Fixes
- [ ] Read QUICK_FIXES_GUIDE.md
- [ ] Create Fix #1 code (OAuth state)
- [ ] Test OAuth state validation
- [ ] Implement Fix #2 (password tokens to DB)
- [ ] Create 005_password_reset_tokens.sql
- [ ] Test password reset flow
- [ ] Implement Fix #3 (policy validation)
- [ ] Test weak password rejected
- [ ] Commit and push
- [ ] Mark complete in checklist

### Day 2: Friend Operations & Recovery Codes
- [ ] Implement Fix #4 (friend operations)
- [ ] Add all friend routes
- [ ] Test list/add/remove/accept
- [ ] Implement Fix #5 (recovery codes)
- [ ] Create 004_recovery_codes.sql
- [ ] Test recovery code generation
- [ ] Test recovery code usage
- [ ] Commit and push
- [ ] Mark complete in checklist

### Day 3: Polish Fixes
- [ ] Implement Fix #6 (oauth_tokens)
- [ ] Implement Fix #7 (default avatar)
- [ ] Fix docker-compose.yml
- [ ] Run full integration test
- [ ] Commit and push
- [ ] Mark complete in checklist

### Day 4+: Testing & Security
- [ ] Create test suite
- [ ] Write integration tests
- [ ] Security audit
- [ ] Fix any findings
- [ ] Deploy to staging
- [ ] Final testing
- [ ] Ready for merge

---

## 📊 PROGRESS TRACKER

**Current Status: 0% of fixes done**

```
Fixes to implement:     [████████████░░░░░░░░░░░] 0%
│
├─ Critical (5):        [░░░░░░░░░░░░░░░░░░░░░░░] 0%
├─ High (2):            [░░░░░░░░░░░░░░░░░░░░░░░] 0%
├─ Medium (3):          [░░░░░░░░░░░░░░░░░░░░░░░] 0%
└─ Before Deploy (3):   [░░░░░░░░░░░░░░░░░░░░░░░] 0%

Tests:                  [░░░░░░░░░░░░░░░░░░░░░░░] 0%
Security:               [░░░░░░░░░░░░░░░░░░░░░░░] 0%
Deployment:             [░░░░░░░░░░░░░░░░░░░░░░░] 0%
```

---

## 🚀 GO LIVE CHECKLIST

Before merging to main:

### Code Quality
- [ ] All 5 critical fixes implemented
- [ ] All 2 high priority fixes done
- [ ] Tests written (4+ hours)
- [ ] Code reviewed
- [ ] No console.log left in production code
- [ ] Error messages don't leak sensitive info

### Security
- [ ] OWASP top 10 checked
- [ ] No hardcoded secrets
- [ ] SQL injection prevention verified
- [ ] CSRF protection (state tokens) implemented
- [ ] Rate limiting working
- [ ] Input validation comprehensive

### Testing
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing complete
- [ ] Edge cases tested
- [ ] Error handling tested

### Deployment
- [ ] Docker builds successfully
- [ ] All services start
- [ ] Database migrations run
- [ ] API responds correctly
- [ ] Logging working
- [ ] Monitoring in place

### Documentation
- [ ] API endpoints documented
- [ ] Database schema explained
- [ ] Setup guide complete
- [ ] Troubleshooting guide ready
- [ ] Deployment guide written

---

## 📚 REFERENCE DOCUMENTS

All code snippets are in: **[QUICK_FIXES_GUIDE.md](QUICK_FIXES_GUIDE.md)**

Full details are in: **[BACKEND_AUDIT_REPORT.md](BACKEND_AUDIT_REPORT.md)**

---

## 💪 YOU'VE GOT THIS!

Your code is **75% done and well-structured.** These fixes are straightforward:

✅ OAuth state validation = simple cache + check  
✅ Password tokens to DB = copy existing DB patterns  
✅ Password policy = reuse existing validation  
✅ Friend operations = mostly copy/paste  
✅ Recovery codes = straightforward generation + usage  

**Estimated total time: 8-12 hours to be production-ready**

Get it done! 🚀
