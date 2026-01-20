import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface SalaryRecord {
  date: string;
  loom: string;
  meters: number;
  loom_id: string;
}

interface SalarySlipProps {
  isOpen: boolean;
  onClose: () => void;
  workerName: string;
  startDate: string;
  endDate: string;
  details: SalaryRecord[];
  summary: {
    total_meters: number;
    total_salary: number;
  };
}

export const SalarySlipModal = ({
  isOpen,
  onClose,
  workerName,
  startDate,
  endDate,
  details,
  summary
}: SalarySlipProps) => {
  // 1. Create the Ref
  const slipRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const uniqueDates = [...new Set(details.map(d => d.date))].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const uniqueLooms = [...new Set(details.map(d => d.loom))].sort((a, b) => a.localeCompare(b, undefined, {
    numeric: true
  }));

  const dateMap: Record<string, Record<string, number>> = {};
  uniqueDates.forEach(date => {
    dateMap[date] = {};
    uniqueLooms.forEach(loom => dateMap[date][loom] = 0);
  });

  const loomTotals: Record<string, number> = {};
  uniqueLooms.forEach(loom => loomTotals[loom] = 0);

  details.forEach(rec => {
    const meters = rec.meters || 0;
    if (dateMap[rec.date] && dateMap[rec.date][rec.loom] !== undefined) {
      dateMap[rec.date][rec.loom] += meters;
    }
    if (loomTotals[rec.loom] !== undefined) {
      loomTotals[rec.loom] += meters;
    }
  });

  const totalMeters = summary.total_meters || 0;
  const totalSalary = summary.total_salary || 0;
  const avgRate = totalMeters > 0 ? totalSalary / totalMeters : 0;

  const handlePrintAndDownload = async () => {
    // 2. THIS WAS FAILING: Now it will find the element because we added the ref below
    const element = slipRef.current;
    if (!element) return;

    setIsDownloading(true);

    try {
      const canvas = await html2canvas(element, {
        scale: 2, 
        useCORS: true,
        backgroundColor: "#ffffff"
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      
      let pdfImgWidth = pageWidth;
      let pdfImgHeight = (imgProps.height * pageWidth) / imgProps.width;

      if (pdfImgHeight > pageHeight) {
        pdfImgHeight = pageHeight;
        pdfImgWidth = (imgProps.width * pageHeight) / imgProps.height;
      }

      const xOffset = (pageWidth - pdfImgWidth) / 2;
      
      pdf.addImage(imgData, 'PNG', xOffset, 0, pdfImgWidth, pdfImgHeight);
      pdf.save(`${workerName}_${endDate}.pdf`);

    } catch (error) {
      console.error("PDF generation failed", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-full print:max-h-full print:overflow-visible">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center justify-between">
            <span>Salary Slip</span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrintAndDownload}
                disabled={isDownloading} // Disable while processing
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4 mr-2" />
                )}
                {isDownloading ? "Generating..." : "Print"}
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* 3. CRITICAL FIX: Added ref={slipRef} here */}
        <div className="salary-slip-content p-4" ref={slipRef}>
          
          {/* Worker Info */}
          <div className="grid grid-cols-2 gap-4 mb-6 bg-muted/50 p-4 rounded-lg">
            <div>
              <span className="ml-2 font-bold text-foreground">{workerName}</span>
            </div>
            <div>
              <span className="font-semibold text-muted-foreground">PERIOD:</span>
              <span className="ml-2 font-bold text-foreground">{startDate} to {endDate}</span>
            </div>
          </div>

          {/* Production Grid */}
          <div className="mb-6 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="p-2 border border-border bg-muted font-bold">DATE</th>
                  {uniqueLooms.map(loom => (
                    <th key={loom} className="p-2 border border-border bg-muted font-bold">
                      {loom.substring(6)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uniqueDates.map(date => (
                  <tr key={date}>
                    <td className="p-2 border border-border font-bold bg-muted/50">
                      {formatDate(date)}
                    </td>
                    {uniqueLooms.map(loom => {
                      const val = dateMap[date][loom];
                      return (
                        <td key={loom} className="p-2 border border-border text-center">
                          {val > 0 ? val.toFixed(1) : "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted font-bold">
                  <td className="p-2 border border-border">TOTAL</td>
                  {uniqueLooms.map(loom => (
                    <td key={loom} className="p-2 border border-border text-center">
                      {loomTotals[loom].toFixed(1)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Summary Section */}
          <div className="grid grid-cols-2 gap-6">
            {/* Loom Summary */}
            <div>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {uniqueLooms.map(loom => (
                    <tr key={loom}>
                      <td className="border border-border p-2 font-bold">{loom.substring(6)}</td>
                      <td className="border border-border p-2 text-right">
                        {loomTotals[loom].toFixed(1)} m
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Grand Totals */}
            <div className="bg-primary/10 p-4 rounded-lg">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Meters:</span>
                  <span className="font-bold text-foreground">{totalMeters.toFixed(2)} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rate per Meter:</span>
                  <span className="font-bold text-foreground">₹ {avgRate.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-primary pt-3">
                  <span className="text-lg font-bold text-foreground">Total Salary:</span>
                  <span className="text-lg font-bold text-primary">₹ {Math.round(totalSalary)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-border text-center text-sm text-muted-foreground">
            <p>Generated on {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};