# Biometric Vault Lab — Speaking Scripts

Three versions of the same story, in increasing length. Pick the one that fits.

- [30-second elevator pitch](#30-second-elevator-pitch) — for someone who asked "what are you working on?"
- [2-minute version](#2-minute-version) — for a colleague, manager, or technical friend
- [5-minute demo script](#5-minute-demo-script) — for a real walkthrough with the app open
- [Q&A prep](#qa-prep) — common questions and answers to have ready

---

## 30-second elevator pitch

> "I built a way for any website to store sensitive data on your phone — like notes, API keys, or chat history — locked by your fingerprint or face. Not a fake biometric lock that hides plaintext, but real encryption where your finger is the actual key. No password, no server, no account. Works offline. The data is just encrypted gibberish on disk until you touch the sensor. I've shipped it as two reusable SDK packages so I can drop it into Cognitive Canvas, MoBrowser, or any other product we build."

**Use this when:** someone at a coffee shop, on a call, or in passing asks "what are you working on?"

---

## 2-minute version

> "Okay so, every app today that wants to remember stuff about you has three bad choices.
>
> One: store your data on their server. That's how Gmail, Notion, basically every SaaS works. The problem — servers get hacked, the company can read everything, they can go out of business, and you can't use the app offline.
>
> Two: store it on your phone, locked by a password. That's 1Password, Bitwarden. Better, but users forget passwords, reuse them, get phished.
>
> Three: just save it in the browser unencrypted. That's what 99% of websites actually do. Any other tab or extension can read it.
>
> What I built is a fourth option. It's a small JavaScript library that lets a web app store data on the user's phone, **encrypted with their fingerprint**. Not pretend-biometric where the fingerprint just hides a UI gate — real encryption, where the user's actual finger on the sensor is what materializes the encryption key. The data is genuinely opaque ciphertext on disk. Only the right finger on the right phone unlocks it.
>
> The trick that makes it possible — modern phones have a secure chip, Apple's Secure Enclave, Android's StrongBox. In the last couple of years browsers got a feature called WebAuthn PRF that lets a web page extract a deterministic random number from that chip, but only after a biometric gesture. I use those random bytes as the encryption key. The bytes never exist on disk — they're computed fresh from the chip every time you touch the sensor, used for a millisecond, then discarded.
>
> If you lose your phone, there's a backup: a one-time recovery code you save at setup. That code can rebuild your vault on any new device.
>
> I've verified it working on Windows, Android, and iPhone with real biometrics. I built it as two npm packages so I can drop it into Cognitive Canvas to give it biometric-locked local memory, drop it into MoBrowser, or any other Muulorigin app that needs sensitive local storage. The whole thing is deployed and live on Vercel as a demo.
>
> That's the project."

**Use this when:** explaining to a colleague, a manager, a technical friend, or pitching it for inclusion in another project.

---

## 5-minute demo script

This version assumes you have the app open on a phone or screen and can show it as you talk. Use the **[ACTION]** markers as cues.

### Setup the room

> "Let me show you what I built. It's running live — I'll walk through the whole flow."

**[ACTION]** Open the Vercel URL on a phone or in a browser tab. Make sure the vault is in the fresh "no vault" state. If not, reset first.

### The problem framing (30 seconds)

> "Quick setup of the problem. Web apps need to remember stuff about you — notes, settings, preferences, chat history with AI assistants. They have three options today, all bad:
>
> Server-side — gets breached, company reads it.
>
> Password-locked locally — users forget, reuse, get phished.
>
> Plaintext locally — anyone with access to your phone reads it.
>
> What if the website could lock your data with your fingerprint, for real, no server, no password?"

### Show setup (1 minute)

**[ACTION]** Tap "Set up vault."

> "I just clicked Set up. The phone is now asking for my biometric — Face ID or fingerprint."

**[ACTION]** Touch sensor / look at camera. Biometric prompt completes.

**[ACTION]** Recovery key reveal screen appears.

> "Behind the scenes, the app just generated a 256-bit random encryption key, encrypted it under a key derived from my fingerprint via the phone's secure chip, and stored only the encrypted version on disk. Now it's showing me this recovery key — this is the one piece of information I have to save, in case I ever lose my phone. It's like a crypto wallet seed phrase. I'll copy it to my notes app right now."

**[ACTION]** Copy the recovery key, paste somewhere visible if doing a slide-presentation, or just say "saved." Check the acknowledgment box. Tap Continue.

> "Now I'm in. This is the vault."

### Show CRUD (1 minute)

**[ACTION]** On the Add an entry form, type:
- Entry id: `demo/secret`
- Data: `"This is a private note that should be encrypted"`
- Tap Save encrypted.

> "I just saved a note. Watch what happens on disk."

**[ACTION]** Open DevTools → Application → IndexedDB → bvl → entries. Show the row.

> "Here's the actual storage. The entry id is in plaintext because it's a lookup key — but look at the ciphertext field. That's an ArrayBuffer of 60 binary bytes. It's the AES-256-GCM encrypted version of my note. The plaintext doesn't exist anywhere on disk."

**[ACTION]** Press Ctrl+F on the IDB panel, search for "private note."

> "Search for 'private note' — zero matches. The plaintext only existed in process memory for the moment I was looking at it on screen."

### Show lock + unlock (1 minute)

**[ACTION]** Tap Lock at the top of the Vault card.

> "I clicked Lock. The in-memory encryption key is wiped. The data on disk hasn't changed — it's still encrypted ciphertext. But there's no way to read it right now."

**[ACTION]** Tap Unlock with biometric.

**[ACTION]** Touch sensor.

> "Touch the sensor — the phone's chip recomputes the same 32 random bytes from my biometric, the app uses them to unwrap the master key, and the data decrypts back into view. No password, no server, no account."

### Show backup + restore (1 minute, optional)

**[ACTION]** Expand the Backup, restore & rotate panel. Paste the recovery key. Tap Export encrypted.

> "I can export an encrypted backup of the whole vault. It's keyed to my recovery key, so anyone with the file plus the recovery key can restore it on any device. Here it downloads."

**[ACTION]** Show the downloaded file. Then Reset the vault. Then re-import.

> "I just wiped the vault completely. Now I'm restoring from the backup file using just the recovery key. Watch — it auto-detects the format, decrypts via the recovery key, rebuilds the storage, and unlocks me into the restored vault."

### The closer (30 seconds)

> "So what I actually built is two reusable npm packages — one TypeScript library that has all the cryptographic logic, one thin React wrapper. Any web app can install them and instantly have biometric-locked local storage. I've verified it on Windows with Windows Hello, Android with fingerprint, and iPhone with Face ID. I'm planning to drop it into Cognitive Canvas to give it biometric-locked AI conversation memory, and into MoBrowser for sensitive browser session data.
>
> The whole thing is deployed and live on Vercel. The two SDK packages are ready to be picked up by any other project. The architecture is documented honestly — I have a SECURITY.md that calls out what this protects against and what it explicitly cannot protect against, so we never overpromise.
>
> Questions?"

---

## Q&A prep

These are the questions people will probably ask. Have an answer ready for each.

### "Wait — what if I lose my phone?"

> "Two paths. If you saved the recovery key — that long random code from setup — you type it on any new device and your vault comes back. If you also have a backup file you exported, you import it on the new device with the recovery key. If you lost both your phone and the recovery key, the data is gone forever. That's the cost of having no server — no second factor, no email reset, no customer service. We're explicit about this in the UI."

### "Isn't this insecure if someone has malware on my computer?"

> "Yes. If malware is running in your browser while the vault is unlocked, it can read your data — same as any other unlocked password manager. We mitigate with a strict Content Security Policy, no inline scripts, no eval, no remote dependencies. But we don't pretend we've solved XSS. We're honest about that in SECURITY.md."

### "How is this different from 1Password?"

> "1Password is a product. This is an embeddable library. 1Password requires a master password; this requires only a fingerprint. 1Password ships their own app; this drops into any web app. And 1Password trusts a server somewhere for sync; this has no server at all. Different use cases."

### "What stops Apple/Google from reading the encryption key?"

> "The key never leaves your device. It's generated locally, encrypted under the biometric chip's secret, and only the encrypted form is stored. Apple/Google can't read what was never sent to them. The only data that touches the network is the static HTML/JS of the app itself, served from a CDN."

### "Why not just use a regular password?"

> "Passwords get phished, reused, forgotten, keylogged. Biometrics don't. Plus the UX is way better — touch the sensor instead of typing a password fifty times a day."

### "What if my fingerprint changes? Cut my finger?"

> "Use the recovery key while the biometric is healing. Same as you'd use Apple's recovery code to unlock your Mac if Touch ID can't see your finger."

### "What about iOS storage limits?"

> "iOS evicts data after seven days of no use unless the app is installed to the home screen. We detect this and show a red warning. The user has to install the PWA — which takes one tap on the share sheet."

### "What does it cost?"

> "Zero infrastructure cost. There's no backend. The app is static HTML/JS served from any CDN. Hosting cost for the entire project is whatever the CDN charges, which for a static site is effectively free at any usage we'll see in years."

### "Can I see the code?"

> "Yes — it's at github.com/AbhiRajIsHere/biometric-vault-lab. The SDK code is small enough to audit in an afternoon. The threat model is in SECURITY.md."

### "Is this production-ready?"

> "The lab is a verified proof of concept. The SDK packages themselves are ready to drop into other projects. There's a short list of future hardening — envelope encryption for cheap rotation, PIN+Argon2 fallback for older phones, multi-vault per origin — that I'd add before shipping it to end users in a high-stakes context. But for our use cases in Cognitive Canvas and MoBrowser, it's ready now."

### "How long did this take to build?"

> "About a day of work, split across four phases — scaffold, crypto, WebAuthn, deployment. The lab is small (3,000 lines of TypeScript) and focused. Most of the time was thinking about the threat model and making sure the SDK API matches the existing ChromaStash SDK conventions exactly."

---

## Tone notes for delivery

- **Be honest.** This project's whole pitch is "we don't lie about security." If someone asks a question whose answer is "this doesn't protect against X," say so plainly. That's the credibility move.
- **Don't oversell.** It's a proof of concept SDK, not a shipped product. Calling it "lab-verified" is accurate; calling it "production-grade" is not yet earned.
- **Lead with the user benefit.** "Your fingerprint unlocks your data, no password, no cloud" — that lands. Architecture diagrams later.
- **Show, don't tell, when possible.** The byte-level DevTools demo is more convincing than any explanation of AES-GCM.
- **Have the recovery key analogy ready.** Most people get "it's like a crypto wallet seed phrase" instantly. The hardware PRF magic takes more setup.
