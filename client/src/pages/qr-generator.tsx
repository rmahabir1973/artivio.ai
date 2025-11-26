import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SidebarInset } from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Download, QrCode, Upload, Trash2, ChevronDown } from "lucide-react";
import { GuestGenerateModal } from "@/components/guest-generate-modal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import QRCodeStyling from "qr-code-styling";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function QRGenerator() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [text, setText] = useState("https://artivio.ai");
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [logoFile, setLogoFile] = useState<string>("");
  const [logoFileName, setLogoFileName] = useState("");
  const [qrSize, setQrSize] = useState("300");
  const [dotColor, setDotColor] = useState("#000000");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [dotStyle, setDotStyle] = useState<"square" | "rounded" | "dots" | "classy" | "classy-rounded">("rounded");
  const [cornerStyle, setCornerStyle] = useState<"square" | "dot" | "extra-rounded">("extra-rounded");
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const qrCodeInstance = useRef<QRCodeStyling | null>(null);

  // Initialize QR Code
  useEffect(() => {
    if (!qrCodeRef.current) return;

    const size = parseInt(qrSize) || 300;
    
    qrCodeInstance.current = new QRCodeStyling({
      width: size,
      height: size,
      data: text || "https://artivio.ai",
      margin: 10,
      qrOptions: {
        typeNumber: 0,
        mode: "Byte",
        errorCorrectionLevel: "H",
      },
      imageOptions: {
        hideBackgroundDots: true,
        imageSize: 0.4,
        margin: 5,
      },
      dotsOptions: {
        color: dotColor,
        type: dotStyle,
      },
      backgroundOptions: {
        color: backgroundColor,
      },
      cornersSquareOptions: {
        color: dotColor,
        type: cornerStyle,
      },
      cornersDotOptions: {
        color: dotColor,
        type: cornerStyle === "dot" ? "dot" : "square",
      },
      image: logoFile || undefined,
    });

    qrCodeInstance.current.append(qrCodeRef.current);

    return () => {
      if (qrCodeRef.current) {
        qrCodeRef.current.innerHTML = "";
      }
    };
  }, []);

  // Update QR Code when settings change
  useEffect(() => {
    if (!qrCodeInstance.current) return;

    const size = parseInt(qrSize) || 300;
    
    qrCodeInstance.current.update({
      width: size,
      height: size,
      data: text || "https://artivio.ai",
      dotsOptions: {
        color: dotColor,
        type: dotStyle,
      },
      backgroundOptions: {
        color: backgroundColor,
      },
      cornersSquareOptions: {
        color: dotColor,
        type: cornerStyle,
      },
      cornersDotOptions: {
        color: dotColor,
        type: cornerStyle === "dot" ? "dot" : "square",
      },
      image: logoFile || undefined,
    });
  }, [text, logoFile, qrSize, dotColor, backgroundColor, dotStyle, cornerStyle]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Maximum logo size is 2MB.",
        variant: "destructive",
      });
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setLogoFile(base64);
        setLogoFileName(file.name);
        toast({
          title: "Logo Uploaded",
          description: `${file.name} will be embedded in QR code`,
        });
      };
      reader.onerror = () => {
        toast({
          title: "Error",
          description: "Failed to read logo file",
          variant: "destructive",
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process logo file",
        variant: "destructive",
      });
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile("");
    setLogoFileName("");
    toast({
      title: "Logo Removed",
      description: "QR code will be generated without logo",
    });
  };

  const handleDownload = async (format: "png" | "svg") => {
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return;
    }

    if (!qrCodeInstance.current) return;

    try {
      if (format === "png") {
        await qrCodeInstance.current.download({
          extension: "png",
          name: "qr-code",
        });
      } else {
        await qrCodeInstance.current.download({
          extension: "svg",
          name: "qr-code",
        });
      }
      toast({
        title: "Downloaded",
        description: `QR code saved as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download QR code",
        variant: "destructive",
      });
    }
  };

  return (
    <SidebarInset>
      <div className="h-full overflow-y-auto">
        <div className="container max-w-7xl mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <QrCode className="h-8 w-8" />
          QR Code Generator
        </h1>
        <p className="text-muted-foreground">
          Create customized QR codes with your logo embedded in the center
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
              <CardDescription>
                Enter the URL or text for your QR code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="qr-text">URL or Text</Label>
                <Textarea
                  id="qr-text"
                  data-testid="input-qr-text"
                  placeholder="https://example.com or any text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logo</CardTitle>
              <CardDescription>
                Optional: Add your logo to the center of the QR code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logo-upload">Upload Logo</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="logo-upload"
                    data-testid="input-logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="flex-1"
                  />
                  {logoFile && (
                    <Button
                      data-testid="button-remove-logo"
                      variant="outline"
                      size="icon"
                      onClick={handleRemoveLogo}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {logoFileName && (
                  <p className="text-sm text-muted-foreground">
                    Current logo: {logoFileName}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customization</CardTitle>
              <CardDescription>
                Adjust the appearance of your QR code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="qr-size">Size (px)</Label>
                  <Input
                    id="qr-size"
                    data-testid="input-qr-size"
                    type="number"
                    min="200"
                    max="1000"
                    value={qrSize}
                    onChange={(e) => setQrSize(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dot-style">Dot Style</Label>
                  <Select value={dotStyle} onValueChange={(val: any) => setDotStyle(val)}>
                    <SelectTrigger id="dot-style" data-testid="select-dot-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="square">Square</SelectItem>
                      <SelectItem value="rounded">Rounded</SelectItem>
                      <SelectItem value="dots">Dots</SelectItem>
                      <SelectItem value="classy">Classy</SelectItem>
                      <SelectItem value="classy-rounded">Classy Rounded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dot-color">Dot Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="dot-color"
                      data-testid="input-dot-color"
                      type="color"
                      value={dotColor}
                      onChange={(e) => setDotColor(e.target.value)}
                      className="h-10 w-20 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={dotColor}
                      onChange={(e) => setDotColor(e.target.value)}
                      className="font-mono text-sm flex-1"
                      placeholder="#000000"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bg-color">Background Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="bg-color"
                      data-testid="input-bg-color"
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="h-10 w-20 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="font-mono text-sm flex-1"
                      placeholder="#ffffff"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="corner-style">Corner Style</Label>
                <Select value={cornerStyle} onValueChange={(val: any) => setCornerStyle(val)}>
                  <SelectTrigger id="corner-style" data-testid="select-corner-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="dot">Dot</SelectItem>
                    <SelectItem value="extra-rounded">Extra Rounded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                Live preview of your QR code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center p-8 bg-muted/50 rounded-lg">
                <div ref={qrCodeRef} data-testid="qr-preview" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Download</CardTitle>
              <CardDescription>
                Save your QR code in different formats
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                data-testid="button-download-png"
                onClick={() => handleDownload("png")}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Download as PNG
              </Button>
              <Button
                data-testid="button-download-svg"
                onClick={() => handleDownload("svg")}
                variant="outline"
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Download as SVG
              </Button>
            </CardContent>
          </Card>

          {/* Tips & Best Practices */}
          <Collapsible className="mt-6">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full">
                <ChevronDown className="mr-2 h-4 w-4" />
                Tips & Best Practices
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-3">
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-sm">Logo Sizing Matters</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-muted-foreground">Keep logos at 20-30% of QR code size. Use high error correction when adding logos to maintain scannability.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-sm">Ensure Color Contrast</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-muted-foreground">Use dark colors for dots and light backgrounds. Avoid low-contrast combinations that reduce scan reliability.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-sm">Control Data Density</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-muted-foreground">Shorter URLs generate simpler, more reliable codes. Complex data requires larger QR codes for proper scanning.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-sm">Test Before Deployment</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-muted-foreground">Scan with multiple devices and apps before printing. Verify links work correctly and test from various distances.</p>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
        </div>
      </div>

      <GuestGenerateModal
        open={showGuestModal}
        onOpenChange={setShowGuestModal}
        featureName="QR Codes"
      />
    </SidebarInset>
  );
}
