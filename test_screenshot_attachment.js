/**
 * Test Script for Screenshot Attachment Debugging
 *
 * HOE TE GEBRUIKEN:
 * 1. Open ServiceNow > System Definition > Scripts - Background
 * 2. Plak deze code
 * 3. Klik op "Run script"
 * 4. Check de output en System Logs
 *
 * Dit script test of screenshot attachment correct werkt
 */

// Test data - simuleert screenshot data van client
var testScreenshots = [{
  name: 'test-screenshot.png',
  type: 'image/png',
  base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' // Minimale 1x1 pixel PNG
}];

gs.info('=== Screenshot Attachment Test START ===');

// Stap 1: Test of we een incident kunnen maken
gs.info('Step 1: Creating test incident...');
var incident = new GlideRecord('incident');
incident.initialize();
incident.setValue('short_description', 'TEST - Screenshot Attachment Test');
incident.setValue('description', 'This is a test incident for screenshot attachment debugging');
incident.setValue('opened_by', gs.getUserID());
incident.setValue('caller_id', gs.getUserID());
incident.setValue('urgency', '3');
incident.setValue('impact', '3');
incident.setValue('state', '1');

var incidentId = incident.insert();
if (!incidentId) {
  gs.error('❌ Failed to create test incident!');
} else {
  gs.info('✅ Test incident created: ' + incident.getValue('number') + ' (sys_id: ' + incidentId + ')');

  // Stap 2: Test screenshot attachment
  gs.info('Step 2: Testing screenshot attachment...');
  gs.info('Screenshot data:');
  gs.info('  - name: ' + testScreenshots[0].name);
  gs.info('  - type: ' + testScreenshots[0].type);
  gs.info('  - base64 length: ' + testScreenshots[0].base64.length);

  try {
    var ticketFactory = new TSMAITicketFactory();
    ticketFactory.attachScreenshotsToRecord('incident', incidentId, testScreenshots);
    gs.info('✅ attachScreenshotsToRecord completed without errors');

    // Stap 3A: Verifieer of attachment is aangemaakt
    gs.info('Step 3A: Verifying attachment was created...');
    var attachmentGr = new GlideRecord('sys_attachment');
    attachmentGr.addQuery('table_name', 'incident');
    attachmentGr.addQuery('table_sys_id', incidentId);
    attachmentGr.query();

    var attachmentFound = false;
    if (attachmentGr.next()) {
      gs.info('✅✅✅ SUCCESS! Attachment found:');
      gs.info('   - File name: ' + attachmentGr.getValue('file_name'));
      gs.info('   - Content type: ' + attachmentGr.getValue('content_type'));
      gs.info('   - Size: ' + attachmentGr.getValue('size_bytes') + ' bytes');
      gs.info('   - Attachment sys_id: ' + attachmentGr.getUniqueValue());
      attachmentFound = true;
    } else {
      gs.warn('⚠️ No attachment found in sys_attachment table');
    }

    // Stap 3B: Verifieer of screenshot info in Comments/Work Notes staat
    gs.info('Step 3B: Verifying screenshot info in Comments and Work Notes...');
    var incidentCheck = new GlideRecord('incident');
    if (incidentCheck.get(incidentId)) {
      var comments = incidentCheck.getValue('comments') || '';
      var workNotes = incidentCheck.getValue('work_notes') || '';

      var commentsHasScreenshotInfo = comments.indexOf('UPLOADED SCREENSHOTS') >= 0;
      var workNotesHasScreenshotInfo = workNotes.indexOf('UPLOADED SCREENSHOTS') >= 0;

      if (commentsHasScreenshotInfo) {
        gs.info('✅ Comments field contains screenshot information');
      } else {
        gs.warn('⚠️ Comments field does NOT contain screenshot information');
      }

      if (workNotesHasScreenshotInfo) {
        gs.info('✅ Work Notes field contains screenshot information');
      } else {
        gs.warn('⚠️ Work Notes field does NOT contain screenshot information');
      }

      // Summary
      gs.info('');
      gs.info('=== TEST SUMMARY ===');
      if (attachmentFound && commentsHasScreenshotInfo && workNotesHasScreenshotInfo) {
        gs.info('✅✅✅ COMPLETE SUCCESS! All features working:');
        gs.info('   1. ✅ Attachment created in sys_attachment');
        gs.info('   2. ✅ Screenshot info in Comments');
        gs.info('   3. ✅ Screenshot info in Work Notes');
      } else if (commentsHasScreenshotInfo || workNotesHasScreenshotInfo) {
        gs.info('⚠️ PARTIAL SUCCESS:');
        gs.info('   - Attachment in sys_attachment: ' + (attachmentFound ? '✅ YES' : '❌ NO'));
        gs.info('   - Screenshot info in Comments: ' + (commentsHasScreenshotInfo ? '✅ YES' : '❌ NO'));
        gs.info('   - Screenshot info in Work Notes: ' + (workNotesHasScreenshotInfo ? '✅ YES' : '❌ NO'));
      } else {
        gs.error('❌❌❌ COMPLETE FAILURE! Nothing worked');
      }
    }

  } catch (error) {
    gs.error('❌ Error during attachment: ' + error.toString());
  }

  // Stap 4: Cleanup - verwijder test incident
  gs.info('Step 4: Cleaning up test incident...');
  incident.deleteRecord();
  gs.info('✅ Test incident deleted');
}

gs.info('=== Screenshot Attachment Test END ===');
gs.info('');
gs.info('NEXT STEPS:');
gs.info('1. Check System Logs for all debug output');
gs.info('2. Look for "=== DEBUG attachScreenshotsToRecord" messages');
gs.info('3. If attachment was found, the issue is in the client→server data flow');
gs.info('4. If attachment was NOT found, the issue is in attachScreenshotsToRecord function');
