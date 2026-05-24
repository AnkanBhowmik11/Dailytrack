import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../db';
import { downloadPDFOnMobile } from './generateAttendancePDF';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export async function generateLedgerPDF(employee, siteName, settings, timeframeMonths) {
  // 1. Calculate the date boundary based on timeframeMonths
  let startDateStr = '1970-01-01'; // All time
  if (timeframeMonths !== 'all') {
    const d = new Date();
    d.setMonth(d.getMonth() - parseInt(timeframeMonths, 10));
    startDateStr = d.toISOString().slice(0, 10);
  }

  // 2. Fetch Data from Dexie
  const attendance = await db.attendance
    .where('employeeId').equals(employee.id)
    .filter(a => a.date >= startDateStr)
    .sortBy('date');

  const transactions = await db.transactions
    .where('employeeId').equals(employee.id)
    .filter(t => t.date >= startDateStr)
    .sortBy('date');

  // 3. Initialize PDF
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.width;
  
  // Header
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(`${settings?.name || 'DailyTrack'} - Employee Ledger`, 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  const timeframeText = timeframeMonths === 'all' ? 'All Time' : `Last ${timeframeMonths} Months`;
  doc.text(`Report Period: ${timeframeText}`, 14, 26);
  
  // Employee Profile Box
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(14, 32, pageWidth - 28, 24, 3, 3, 'FD');
  
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Employee: ${employee.name}`, 18, 40);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Role: ${employee.designation || 'Staff'}`, 18, 46);
  doc.text(`Site: ${siteName || 'Unknown'}`, 18, 51);
  
  doc.text(`Rate: Rs ${employee.baseRate} / ${employee.rateType === 'monthly' ? 'month' : 'day'}`, 120, 40);
  doc.text(`OT Rate: Rs ${employee.otRate || settings?.defaultOtRate || 100} / hr`, 120, 46);

  // Summary Math
  let P = 0, HD = 0, A = 0, ot = 0;
  attendance.forEach(a => {
    if (a.status === 'P') P++;
    else if (a.status === 'HD') HD++;
    else if (a.status === 'A') A++;
    ot += (a.otHours || 0);
  });
  
  let paid = 0, advances = 0, repayments = 0;
  transactions.forEach(t => {
    const amt = Number(t.amount || 0);
    const type = t.type.toLowerCase();
    if (type === 'salary' || type === 'bonus' || type === 'others') paid += amt;
    else if (type === 'advance') advances += amt;
    else if (type === 'repayment') repayments += amt;
  });

  doc.setFontSize(10);
  doc.setTextColor(22, 163, 74); // green-600
  doc.text(`Total Paid: Rs ${paid.toLocaleString('en-IN')}`, 200, 40);
  doc.setTextColor(217, 119, 6); // amber-600
  doc.text(`Total Advances: Rs ${advances.toLocaleString('en-IN')}`, 200, 46);
  doc.setTextColor(15, 23, 42);
  doc.text(`Attendance: ${P}P, ${HD}HD, ${A}A, ${ot}h OT`, 200, 51);

  let currentY = 65;

  // 4. Attendance Table
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Attendance Log", 14, currentY);
  
  const attHead = [['Date', 'Status', 'In Time', 'Out Time', 'OT Hrs', 'Note']];
  const attBody = attendance.map(a => [
    a.date,
    a.status,
    a.timeIn || '-',
    a.timeOut || '-',
    a.otHours || '-',
    a.note || '-'
  ]);

  if (attBody.length > 0) {
    autoTable(doc, {
      head: attHead,
      body: attBody,
      startY: currentY + 4,
      styles: { fontSize: 8 },
      theme: 'grid',
      headStyles: { fillColor: [5, 150, 105] }, // emerald-600
      margin: { left: 14, right: 14 }
    });
    currentY = doc.lastAutoTable.finalY + 15;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("No attendance records found for this period.", 14, currentY + 6);
    currentY += 15;
  }

  // Check page break
  if (currentY > doc.internal.pageSize.height - 40) {
    doc.addPage();
    currentY = 20;
  }

  // 5. Transaction Table
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Transaction History", 14, currentY);
  
  const txHead = [['Date', 'Type', 'Amount (Rs)', 'Note']];
  const txBody = transactions.map(t => [
    t.date,
    t.type,
    Number(t.amount || 0).toLocaleString('en-IN'),
    t.note || '-'
  ]);

  if (txBody.length > 0) {
    autoTable(doc, {
      head: txHead,
      body: txBody,
      startY: currentY + 4,
      styles: { fontSize: 8 },
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }, // indigo-600
      margin: { left: 14, right: 14 }
    });
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("No transactions found for this period.", 14, currentY + 6);
  }

  // 6. Download
  const fileName = `${employee.name.replace(/\s+/g,'_')}_Ledger_${timeframeMonths}M.pdf`;
  await downloadPDFOnMobile(doc, fileName);
}
