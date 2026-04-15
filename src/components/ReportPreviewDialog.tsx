import { useRef } from 'react';
import { Download, Printer, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface ReportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  html: string;
  onDownloadExcel?: () => void;
}

const ReportPreviewDialog = ({ open, onOpenChange, title, html, onDownloadExcel }: ReportPreviewDialogProps) => {
  const { t } = useLanguage();
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
      <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 md:px-6 pt-4 md:pt-6 pb-3 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <DialogTitle className="text-base md:text-lg truncate">{title}</DialogTitle>
            <div className="flex items-center gap-2 flex-shrink-0">
              {onDownloadExcel && (
                <Button variant="outline" size="sm" onClick={onDownloadExcel} className="text-xs md:text-sm">
                  <FileSpreadsheet className="w-4 h-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">Excel</span>
                  <span className="sm:hidden">XLS</span>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="text-xs md:text-sm">
                <Download className="w-4 h-4 mr-1 md:mr-2" />
                PDF
              </Button>
              <Button size="sm" onClick={handlePrint} className="text-xs md:text-sm">
                <Printer className="w-4 h-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Print</span>
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto px-4 md:px-6 pb-4 md:pb-6">
          <div className="border rounded-lg bg-white overflow-hidden">
            <iframe
              ref={iframeRef}
              srcDoc={html}
              className="w-full border-0"
              style={{ minHeight: '400px', height: '65vh' }}
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
