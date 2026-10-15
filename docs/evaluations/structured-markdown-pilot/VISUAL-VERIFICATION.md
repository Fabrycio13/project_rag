# Visual and execution verification

- Generator executed successfully twice against the actual current extractor; exact page-gold 9/9, row tuples 2/2, critical literals 7/7.
- Independent manifest verification: all 10 artifact sizes and SHA-256 hashes matched. Independent span identity verification: 51 unique page/index pairs, 51 total assignments.
- All three PNG renders inspected through the image tool. Page 1 shows C1/C2/C3 with the monthly amount, negations and strict >48-hour exception; page 2 shows the Base row and continuation notice; page 3 shows Extra, the approval/nonaccumulation note, distinct operational/audit retention and inert adversarial test. No visible overlap or clipping. Preview typography is narrow; no pixel-perfect font certification is claimed.
- HTML is self-contained: three real PDF PNGs embedded as data images, escaped literal evidence, no remote assets or provider calls. It includes page navigation, raw extraction and native-spans disclosures, rendered structured fragments, Markdown source and review flags.
- **HTML NOT browser-tested.** The local browser attempt was blocked because Chrome's real profile was locked. No browser was closed and no user session was interrupted. No Playwright/Puppeteer package was available in this repository; no dependency was installed. Opening review.html locally remains the manual UI check.
- No app routes, auth, migrations, database/indexing actions, remote uploads, commits or pushes performed. Only this evaluation directory was added; the initial tracked worktree was clean.
