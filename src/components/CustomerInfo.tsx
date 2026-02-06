import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Facebook, Phone, RotateCcw, Image as ImageIcon, Upload } from "lucide-react";
import { Button } from "./ui/button";
import { useRef } from "react";

interface CustomerInfoProps {
  customerName: string;
  fbLink: string;
  phone: string;
  designFile: File | null;
  onCustomerNameChange: (value: string) => void;
  onFbLinkChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onDesignFileChange: (file: File | null) => void;
  onClear: () => void;
}

export function CustomerInfo({
  customerName,
  fbLink,
  phone,
  designFile,
  onCustomerNameChange,
  onFbLinkChange,
  onPhoneChange,
  onDesignFileChange,
  onClear,
}: CustomerInfoProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    onDesignFileChange(file);
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Customer Information
            </CardTitle>
            <CardDescription>
              Details apply to the next items you add
            </CardDescription>
          </div>
          {(customerName || fbLink || phone || designFile) && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                onClear();
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="h-8 gap-2"
            >
              <RotateCcw className="h-3 w-3" />
              New Person
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="customerName" className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Customer Name
            </Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
              placeholder="Enter name"
              className="h-11"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fbLink" className="flex items-center gap-2">
              <Facebook className="h-4 w-4 text-muted-foreground" />
              FB Profile Link
            </Label>
            <Input
              id="fbLink"
              value={fbLink}
              onChange={(e) => onFbLinkChange(e.target.value)}
              placeholder="facebook.com/your-profile"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              PH Phone Number
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              placeholder="09XX XXX XXXX"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              Design / Logo
            </Label>
            <div className="relative">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className={`w-full h-11 justify-start gap-2 font-normal overflow-hidden ${!designFile ? 'text-muted-foreground' : 'text-foreground'}`}
              >
                <Upload className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {designFile ? designFile.name : "Upload Design"}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
