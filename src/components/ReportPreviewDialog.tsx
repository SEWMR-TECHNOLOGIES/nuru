import { useRef } from 'react';
import { Download, Printer, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ReportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  html: string;
  onDownloadExcel?: () => void;
}

const ReportPreviewDialog = ({ open, onOpenChange, title, html, onDownloadExcel }: ReportPreviewDialogProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const handleDownloadPdf = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const pdfHtml = html.replace('</head>', `
        <style>
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>`);
      printWindow.document.write(pdfHtml);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
            <div className="flex items-center gap-2">
              {onDownloadExcel && (
                <Button variant="outline" size="sm" onClick={onDownloadExcel}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Excel
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
          <div className="border rounded-lg bg-white overflow-hidden">
            <iframe
              ref={iframeRef}
              srcDoc={html}
              className="w-full border-0"
              style={{ minHeight: '600px', height: '70vh' }}
              title="Report Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportPreviewDialog;
