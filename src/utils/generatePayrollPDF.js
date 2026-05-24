import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadPDFOnMobile } from './generateAttendancePDF';

export async function generatePayrollPDF(siteName, month, year, payrollList, totalNet) {
  const doc = new jsPDF('landscape');
  doc.setFontSize(18);
  doc.text(`Payroll Report: ${siteName}`, 14, 22);
  doc.setFontSize(12);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  doc.text(`${months[month-1]} ${year}`, 14, 30);

  const head = [[
    'Name', 'Role', 'Type', 'Rate (Rs)', 'P', 'HD', 'A', 'OT Hrs', 
    'Base Pay', 'OT Pay', 'Gross Salary', 'Total Paid/Adv', 'Due Balance'
  ]];

  const body = payrollList.map(row => {
    return [
      row.employee.name,
      row.employee.designation || 'Staff',
      row.employee.rateType === 'monthly' ? 'Monthly' : 'Daily',
      `${row.employee.baseRate}`,
      String(row.P),
      String(row.HD),
      String(row.A),
      String(row.ot),
      `${row.baseWages}`,
      `${row.otWages}`,
      `${row.gross}`,
      `${row.totalPaid}`,
      `${row.dueBalance}`
    ];
  });

  autoTable(doc, {
    head: head,
    body: body,
    startY: 36,
    styles: { fontSize: 8 },
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] }
  });

  doc.setFontSize(14);
  doc.text(`Total Due Payroll: Rs ${totalNet.toLocaleString('en-IN')}`, 14, doc.lastAutoTable.finalY + 12);

  const fileName = `Payroll_${siteName.replace(/\s+/g,'_')}_${months[month-1]}_${year}.pdf`;
  await downloadPDFOnMobile(doc, fileName);
}
