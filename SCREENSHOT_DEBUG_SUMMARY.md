# Screenshot Attachment Debugging - Samenvatting

## Wat is er gedaan?

### 1. Debug Logging Toegevoegd

**In TSMAIRequestOrchestrator.js (lines 405-434):**
- ✅ Expliciete check van alle drie conditie-waarden
- ✅ Logging VOOR de if-statement om te zien welke conditie faalt
- ✅ Duidelijke markers (✅/❌) om success/failure te identificeren

**In TSMAITicketFactory.js (lines 327-391):**
- ✅ Logging van alle screenshot properties (name, base64 length, type)
- ✅ Logging van elke stap in het attachment proces
- ✅ Error handling voor individuele screenshots

### 2. Test Script Aangemaakt

**Bestand: test_screenshot_attachment.js**
- Direct uitvoerbaar in Scripts - Background
- Test de complete attachment flow
- Verifieert of attachments correct worden aangemaakt
- Automatische cleanup

## Hoe te gebruiken

### Stap 1: Voer Test Script Uit

1. Open ServiceNow > **System Definition > Scripts - Background**
2. Plak de inhoud van `test_screenshot_attachment.js`
3. Klik **Run script**
4. Bekijk de output in System Logs

**Verwachte Output:**
```
=== Screenshot Attachment Test START ===
Step 1: Creating test incident...
✅ Test incident created: INC0010001 (sys_id: abc123...)
Step 2: Testing screenshot attachment...
=== DEBUG attachScreenshotsToRecord START ===
...
✅✅✅ SUCCESS! Attachment found:
```

### Stap 2: Test via Widget

1. Open de AI widget in Service Portal
2. Voer een incident-vraag in
3. Upload een screenshot in de vragenformulier
4. Submit het incident
5. Check **System Logs** voor deze markers:

**Zoek naar:**
```
=== DEBUG submitUniversalRequest ===
submissionData.screenshots.length: 1
First screenshot has base64: true
First screenshot name: [filename]

=== DEBUG Attachment Condition Check ===
ALL CONDITIONS MET: YES - WILL ATTACH
✅ CALLING attachScreenshotsToRecord

=== DEBUG attachScreenshotsToRecord START ===
✅ Screenshot attached successfully
```

## Mogelijke Oorzaken en Oplossingen

### Oorzaak 1: Conditie faalt
**Symptomen:**
```
ALL CONDITIONS MET: NO - SKIPPING
❌ SKIPPING screenshot attachment - Condition failed!
```

**Check:**
- `submissionData.screenshots exists: NO` → Screenshots niet doorgestuurd van client
- `submissionData.screenshots.length: 0` → Lege array doorgestuurd
- `Has sys_id: NO` → Incident niet correct aangemaakt

**Oplossing:** Depends on which condition fails

### Oorzaak 2: Base64 Data Corrupt
**Symptomen:**
```
✅ CALLING attachScreenshotsToRecord
Screenshot 0 - base64 length: 0
SKIPPING screenshot 0 - missing base64 or name
```

**Oplossing:** Check of base64 correct wordt gegenereerd in client

### Oorzaak 3: GlideSysAttachment.write() faalt
**Symptomen:**
```
Base64 decoded, writing to attachment...
❌ Failed to attach screenshot - gsa.write returned null/false
```

**Oplossing:**
- Check permissions voor attachment API
- Verify base64 decode werkt correct
- Check of table en sys_id valid zijn

### Oorzaak 4: JSON Serialization Limit
**Symptomen:**
- Screenshots komen niet aan bij server
- `submissionData.screenshots.length: 0` maar client heeft wel screenshots

**Oplossing:**
- Beperk screenshot grootte in client (zie MAX_FILE_SIZE in client.js)
- Gebruik compressie voor screenshots
- Upload screenshots apart via REST API

## Volgende Stappen

1. **Voer test script uit** om basis functionaliteit te verifiëren
2. **Test via widget** met daadwerkelijke screenshot upload
3. **Analyseer System Logs** met de nieuwe debug output
4. **Identificeer welke conditie faalt** aan de hand van de markers
5. **Pas oplossing toe** gebaseerd op de specifieke oorzaak

## Log Markers om naar te zoeken

| Marker | Betekenis |
|--------|-----------|
| `=== DEBUG submitUniversalRequest ===` | Start van submission proces |
| `submissionData.screenshots.length: X` | Aantal screenshots ontvangen |
| `=== DEBUG Attachment Condition Check ===` | Check of attachment wordt uitgevoerd |
| `ALL CONDITIONS MET: YES` | Alle checks geslaagd, attachment wordt uitgevoerd |
| `ALL CONDITIONS MET: NO` | Check gefaald, zie welke conditie false is |
| `✅ CALLING attachScreenshotsToRecord` | Attachment functie wordt aangeroepen |
| `=== DEBUG attachScreenshotsToRecord START ===` | Start van attachment proces |
| `✅ Screenshot attached successfully` | Attachment gelukt! |
| `❌ Failed to attach screenshot` | Attachment mislukt |

## Status

- ✅ Debug logging toegevoegd in TSMAIRequestOrchestrator.js
- ✅ Debug logging toegevoegd in TSMAITicketFactory.js
- ✅ Test script aangemaakt
- ⏳ Wacht op test resultaten om root cause te identificeren
