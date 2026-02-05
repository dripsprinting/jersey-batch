import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Mail, Phone } from "lucide-react";

interface CustomerInfoProps {
  teamName: string;
  email: string;
  phone: string;
  onTeamNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
}

export function CustomerInfo({
  teamName,
  email,
  phone,
  onTeamNameChange,
  onEmailChange,
  onPhoneChange,
}: CustomerInfoProps) {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Information
        </CardTitle>
        <CardDescription>
          Enter your team or customer name once — it applies to all jerseys in this batch
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="teamName" className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Team / Customer Name
            </Label>
            <Input
              id="teamName"
              value={teamName}
              onChange={(e) => onTeamNameChange(e.target.value)}
              placeholder="Enter team name"
              className="h-11"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Contact Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="team@example.com"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              Contact Phone
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="h-11"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
