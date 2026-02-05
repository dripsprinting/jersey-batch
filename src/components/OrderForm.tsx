import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { JerseyPreview } from "./JerseyPreview";
import { Plus, User, Hash } from "lucide-react";
import { motion } from "framer-motion";

export interface JerseyItem {
  id: string;
  playerName: string;
  jerseyNumber: string;
  size: string;
  style: "home" | "away";
}

interface OrderFormProps {
  onAddJersey: (jersey: Omit<JerseyItem, "id">) => void;
}

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

export function OrderForm({ onAddJersey }: OrderFormProps) {
  const [playerName, setPlayerName] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [size, setSize] = useState("M");
  const [style, setStyle] = useState<"home" | "away">("home");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !jerseyNumber.trim()) return;

    onAddJersey({
      playerName: playerName.trim(),
      jerseyNumber: jerseyNumber.trim(),
      size,
      style,
    });

    // Reset form
    setPlayerName("");
    setJerseyNumber("");
    setSize("M");
    setStyle("home");
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2 items-start">
      {/* Form Section */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-xl">Add Player Jersey</CardTitle>
          <CardDescription>Enter player details to see a live preview</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="playerName" className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Player Name
              </Label>
              <Input
                id="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter player name"
                className="h-11"
                maxLength={20}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="jerseyNumber" className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                Jersey Number
              </Label>
              <Input
                id="jerseyNumber"
                value={jerseyNumber}
                onChange={(e) => setJerseyNumber(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="00"
                className="h-11"
                maxLength={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Size</Label>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Style</Label>
                <Select value={style} onValueChange={(v) => setStyle(v as "home" | "away")}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home">Home</SelectItem>
                    <SelectItem value="away">Away</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              disabled={!playerName.trim() || !jerseyNumber.trim()}
            >
              <Plus className="mr-2 h-5 w-5" />
              Add to Batch
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Preview Section */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col items-center justify-center p-8 rounded-xl bg-gradient-to-br from-muted/50 to-muted min-h-[400px]"
      >
        <p className="text-sm text-muted-foreground mb-6 font-medium uppercase tracking-wider">
          Live Preview
        </p>
        <div className="animate-float">
          <JerseyPreview
            playerName={playerName}
            jerseyNumber={jerseyNumber}
            style={style}
            size="lg"
          />
        </div>
        <div className="mt-6 text-center">
          <p className="text-lg font-semibold">{playerName || "Player Name"}</p>
          <p className="text-sm text-muted-foreground">
            #{jerseyNumber || "00"} • Size {size} • {style === "home" ? "Home" : "Away"}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
