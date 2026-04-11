import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyHmac } from "./jwtUtils";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";

interface Props {
  token: string;
  algorithm: string;
}

export const SignatureVerifier = ({ token, algorithm }: Props) => {
  const [secret, setSecret] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const alg = algorithm.toUpperCase();
  const isHmac = alg.startsWith("HS");
  const isRsa = alg.startsWith("RS") || alg.startsWith("PS");
  const isEc = alg.startsWith("ES");

  const verify = async () => {
    if (!secret.trim()) return;
    setLoading(true);
    try {
      if (isHmac) {
        const valid = await verifyHmac(token, secret, algorithm);
        setResult(valid);
        toast[valid ? "success" : "error"](valid ? "Signature valid" : "Signature invalid");
      } else {
        toast.info("RSA/ECDSA verification requires public key import — coming soon");
        setResult(null);
      }
    } catch (e: any) {
      toast.error(e.message);
      setResult(false);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={secret}
          onChange={e => setSecret(e.target.value)}
          placeholder={isHmac ? "Enter HMAC secret..." : isRsa ? "Paste RSA public key..." : "Paste EC public key..."}
          type="password"
          className="flex-1 font-mono text-xs h-8"
        />
        <Button size="sm" className="h-8" onClick={verify} disabled={!secret.trim() || loading}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Verify"}
        </Button>
      </div>
      {result !== null && (
        <div className={`flex items-center gap-2 text-sm font-medium ${result ? "text-green-500" : "text-destructive"}`}>
          {result ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
          {result ? "Signature is valid ✓" : "Signature is invalid ✗"}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        Algorithm: <span className="font-mono">{algorithm}</span> •
        {isHmac ? " Symmetric (HMAC)" : isRsa ? " Asymmetric (RSA)" : isEc ? " Asymmetric (ECDSA)" : " Unknown"}
      </p>
    </div>
  );
};
