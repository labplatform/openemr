<?php
/**
* Script to display results for a given procedure order.
*
* Copyright (C) 2013-2015 Rod Roark <rod@sunsetsystems.com>
*
* LICENSE: This program is free software; you can redistribute it and/or
* modify it under the terms of the GNU General Public License
* as published by the Free Software Foundation; either version 2
* of the License, or (at your option) any later version.
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.
* You should have received a copy of the GNU General Public License
* along with this program.  If not, see <http://opensource.org/licenses/gpl-license.php>.
*
* @package   OpenEMR
* @author    Rod Roark <rod@sunsetsystems.com>
*/




require_once(dirname(__FILE__) . '/../globals.php');
require_once($GLOBALS["include_root"] . "/orders/single_order_results.inc.php");

use Mpdf\Mpdf;

// Check authorization.
$thisauth = acl_check('patients', 'med');
if (!$thisauth) {
    die(xl('Not authorized'));
}

$orderid = intval($_GET['orderid']);

$finals_only = empty($_POST['form_showall']);

if (!empty($_POST['form_sign']) && !empty($_POST['form_sign_list'])) {
    if (!acl_check('patients', 'sign')) {
        die(xl('Not authorized to sign results'));
    }

  // When signing results we are careful to sign only those reports that were
  // in the sending form. While this will usually be all the reports linked to
  // the order it's possible for a new report to come in while viewing these,
  // and it would be very bad to sign results that nobody has seen!
    $arrSign = explode(',', $_POST['form_sign_list']);
    foreach ($arrSign as $id) {
        sqlStatement("UPDATE procedure_report SET " .
        "review_status = 'reviewed' WHERE " .
        "procedure_report_id = ?", array($id));
    }
}

// This mess generates a PDF report and sends it to the patient.
if (!empty($_POST['form_send_to_portal'])) {
    // Borrowing the general strategy here from custom_report.php.
    // See also: http://wiki.spipu.net/doku.php?id=html2pdf:en:v3:output
    require_once($GLOBALS["include_root"] . "/cmsportal/portal.inc.php");
    $config_mpdf = array(
        'tempDir' => $GLOBALS['MPDF_WRITE_DIR'],
        'mode' => $GLOBALS['pdf_language'],
        'format' => 'Letter',
        'default_font_size' => '9',
        'default_font' => 'dejavusans',
        'margin_left' => $GLOBALS['pdf_left_margin'],
        'margin_right' => $GLOBALS['pdf_right_margin'],
        'margin_top' => $GLOBALS['pdf_top_margin'],
        'margin_bottom' => $GLOBALS['pdf_bottom_margin'],
        'margin_header' => '',
        'margin_footer' => '',
        'orientation' => 'P',
        'shrink_tables_to_fit' => 1,
        'use_kwt' => true,
        'autoScriptToLang' => true,
        'keep_table_proportions' => true
    );
    $pdf = new mPDF($config_mpdf);
    if ($_SESSION['language_direction'] == 'rtl') {
        $pdf->SetDirectionality('rtl');
    }
    ob_start();
    echo "<link rel='stylesheet' type='text/css' href='$webserver_root/interface/themes/style_pdf.css'>\n";
    echo "<link rel='stylesheet' type='text/css' href='$webserver_root/library/ESign/css/esign_report.css'>\n";
    $GLOBALS['PATIENT_REPORT_ACTIVE'] = true;
    generate_order_report($orderid, false, true, $finals_only);
    $GLOBALS['PATIENT_REPORT_ACTIVE'] = false;
    // echo ob_get_clean(); exit(); // debugging
    $pdf->writeHTML(ob_get_clean());
    $contents = $pdf->Output('', true);
    // Send message with PDF as attachment.
    $result = cms_portal_call(array(
    'action'   => 'putmessage',
    'user'     => $_POST['form_send_to_portal'],
    'title'    => xl('Your Lab Results'),
    'message'  => xl('Please see the attached PDF.'),
    'filename' => 'results.pdf',
    'mimetype' => 'application/pdf',
    'contents' => base64_encode($contents),
    ));
    if ($result['errmsg']) {
        die(text($result['errmsg']));
    }
}
?>
<html>
<head>
<link rel="stylesheet" href='<?php echo $css_header; ?>' type='text/css'>
<title><?php echo xlt('Order Results'); ?></title>
<style>
body {
 margin: 9pt;
 font-family: sans-serif;
 font-size: 1em;
}
</style>

<script type="text/javascript" src="../../library/topdialog.js"></script>
<script language="JavaScript">
<?php require($GLOBALS['srcdir'] . "/restoreSession.php"); ?>
</script>

</head>
<body>
<?php
if (empty($_POST['form_sign'])) {
    generate_order_report($orderid, true, true, $finals_only);
} else {
?>
<script language='JavaScript'>
 if (opener.document.forms && opener.document.forms[0]) {
  // Opener should be list_reports.php. Make it refresh.
  var f = opener.document.forms[0];
  if (f.form_external_refresh) {
   f.form_external_refresh.value = '1';
   f.submit();
  }
 }
 window.close();
</script>
<?php
}
?>
</body>
</html>
