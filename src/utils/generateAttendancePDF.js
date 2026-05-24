import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// Shared download function for PDFs
export async function downloadPDFOnMobile(pdfDoc, fileName) {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64data = pdfDoc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64data,
        directory: Directory.Documents
      });
      await Share.share({
        title: fileName,
        text: 'Here is your PDF',
        url: savedFile.uri,
        dialogTitle: 'Save or Share PDF'
      });
    } catch (e) {
      console.error('File save error', e);
      alert('Could not save file on device');
    }
  } else {
    pdfDoc.save(fileName);
  }
}

export async function generateAttendancePDF(siteName, month, year, employees, attendanceRecords) {
  const doc = new jsPDF('landscape');
  doc.setFontSize(18);
  doc.text(`Attendance Report: ${siteName}`, 14, 22);
  doc.setFontSize(12);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  doc.text(`${months[month-1]} ${year}`, 14, 30);

  const daysInMonth = new Date(year, month, 0).getDate();
  const dayCols = Array.from({length: daysInMonth}, (_, i) => String(i + 1));
  
  const head = [['Name', ...dayCols, 'P', 'HD', 'A', 'OT']];
  
  const body = employees.map(emp => {
    const empRecs = attendanceRecords.filter(r => r.employeeId === emp.id);
    let p=0, hd=0, a=0, ot=0;
    
    const row = [emp.name];
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const r = empRecs.find(rec => rec.date === dateStr);
      if (r) {
        let txt = r.status;
        if (r.otHours > 0) txt += `\n+${r.otHours}h`;
        row.push(txt);
        
        if (r.status === 'P') p++;
        if (r.status === 'HD') hd++;
        if (r.status === 'A') a++;
        if (r.otHours) ot += r.otHours;
      } else {
        row.push('');
      }
    }
    row.push(String(p), String(hd), String(a), String(ot));
    return row;
  });

  autoTable(doc, {
    head: head,
    body: body,
    startY: 36,
    styles: { fontSize: 7, cellPadding: 1, halign: 'center' },
    columnStyles: { 0: { halign: 'left', cellWidth: 25 } },
    theme: 'grid'
  });

  const fileName = `Attendance_${siteName.replace(/\s+/g,'_')}_${months[month-1]}_${year}.pdf`;
  await downloadPDFOnMobile(doc, fileName);
}
