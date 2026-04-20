import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Smartphone, Building2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { showApiErrors } from "@/lib/api/showApiErrors";
import { useCurrency } from "@/hooks/useCurrency";
import { validateMobileMoneyPhone } from "@/lib/validators/phone";
import type { PaymentProfile, PaymentProvider, PayoutMethodType } from "@/lib/api/payments-types";

interface PaymentSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit an existing profile, or omit to create. */
  profile?: PaymentProfile | null;
  onSaved?: (profile: PaymentProfile) => void;
}

/**
 * PaymentSetupModal — Phase 4.
 *
 * Adds or edits a payout profile (mobile money or bank account) for the
 * current user. Providers list is filtered to the user's country and to
 * `supports_payout = true`.
 *
 * Mobile networks (M-Pesa, Mixx by Yas, Airtel Money, HaloPesa) and banks (CRDB, NMB,
 * NBC…) are shown as a Select dropdown so the user can pick from a clear
 * list of supported providers for their country.
 */
export const PaymentSetupModal = ({
  open,
  onOpenChange,
  profile,
  onSaved,
}: PaymentSetupModalProps) => {
  const { countryCode } = useCurrency();
  // Local UI tab uses "bank_account" for compatibility with the existing
  // tabs/labels; the wire-format ("bank") is computed at submit time.
  const initialMethod: PayoutMethodType =
    profile?.method_type === "bank" ? "bank_account" : "mobile_money";
  const [methodType, setMethodType] = useState<PayoutMethodType>(initialMethod);
  const [providerId, setProviderId] = useState(profile?.provider_id ?? "");
  const [accountName, setAccountName] = useState(profile?.account_holder_name ?? "");
  const [accountNumber, setAccountNumber] = useState(profile?.account_number ?? "");
  const [phone, setPhone] = useState(profile?.phone_number ?? "");
  const [bankBranch, setBankBranch] = useState(""); // backend has no bank_branch column today
  const [setDefault, setSetDefault] = useState(profile?.is_default ?? true);
  const [submitting, setSubmitting] = useState(false);

  // Reset when reopened
  useEffect(() => {
    if (open) {
      setMethodType(profile?.method_type === "bank" ? "bank_account" : "mobile_money");
      setProviderId(profile?.provider_id ?? "");
      setAccountName(profile?.account_holder_name ?? "");
      setAccountNumber(profile?.account_number ?? "");
      setPhone(profile?.phone_number ?? "");
      setBankBranch("");
      setSetDefault(profile?.is_default ?? true);
    }
  }, [open, profile]);

  const providersQuery = useQuery({
    queryKey: ["payout-providers", countryCode],
    enabled: open && !!countryCode,
    queryFn: async () => {
      const res = await api.payments.providers({
        country_code: countryCode!,
        purpose: "payout",
      });
      return res.success ? (Array.isArray(res.data) ? res.data : []) : [];
    },
  });

  const filtered: PaymentProvider[] = (providersQuery.data ?? []).filter((p) =>
    methodType === "mobile_money" ? p.provider_type === "mobile_money" : p.provider_type === "bank"
  );

  // Auto-pick first provider on rail change
  useEffect(() => {
    if (filtered.length && !filtered.find((p) => p.id === providerId)) {
      setProviderId(filtered[0].id);
    }
  }, [filtered, providerId]);

  const handleSubmit = async () => {
    if (!countryCode) {
      toast.error("Confirm your country first");
      return;
    }
    if (!providerId) {
      toast.error(methodType === "mobile_money" ? "Choose a mobile network" : "Choose your bank");
      return;
    }
    if (!accountName.trim()) {
      toast.error("Account holder name is required");
      return;
    }
    if (methodType === "mobile_money") {
      const phoneCheck = validateMobileMoneyPhone(phone, countryCode);
      if (!phoneCheck.ok) {
        toast.error(phoneCheck.message);
        return;
      }
    }
    if (methodType === "bank_account" && !accountNumber.trim()) {
      toast.error("Bank account number is required");
      return;
    }

    // Resolve provider so we can derive currency + names the backend expects.
    const selectedProvider = (providersQuery.data ?? []).find((p) => p.id === providerId);
    const currencyCode = selectedProvider?.currency_code;
    if (!currencyCode) {
      toast.error("Selected provider is missing currency info. Please reselect.");
      return;
    }

    setSubmitting(true);
    try {
      const phoneE164 = methodType === "mobile_money"
        ? validateMobileMoneyPhone(phone, countryCode).e164
        : undefined;
      // Backend (payment_profiles.py) expects: country_code, currency_code,
      // method_type ('mobile_money' | 'bank'), provider_id, account_holder_name,
      // phone_number, network_name, bank_name, account_number, is_default.
      const payload = {
        method_type: (methodType === "bank_account" ? "bank" : "mobile_money") as "mobile_money" | "bank",
        provider_id: providerId,
        country_code: countryCode,
        currency_code: currencyCode,
        account_holder_name: accountName.trim(),
        phone_number: phoneE164,
        account_number: methodType === "bank_account" ? accountNumber.trim() : undefined,
        network_name: methodType === "mobile_money"
          ? (selectedProvider?.name ?? selectedProvider?.code)
          : undefined,
        bank_name: methodType === "bank_account"
          ? (selectedProvider?.name ?? selectedProvider?.code)
          : undefined,
        bank_branch: methodType === "bank_account" ? bankBranch.trim() || undefined : undefined,
        is_default: setDefault,
      };
      const res = profile
        ? await api.paymentProfiles.update(profile.id, payload)
        : await api.paymentProfiles.create(payload);

      if (!res.success || !res.data) {
        showApiErrors(res, "Could not save payout profile");
        return;
      }

      toast.success(profile ? "Payout profile updated" : "Payout profile saved");
      onSaved?.(res.data);
      onOpenChange(false);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{profile ? "Edit payout method" : "Add payout method"}</DialogTitle>
          <DialogDescription>
            Where should we send your earnings?
          </DialogDescription>
        </DialogHeader>

        <Tabs value={methodType} onValueChange={(v) => setMethodType(v as PayoutMethodType)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="mobile_money" className="gap-2">
              <Smartphone className="h-4 w-4" /> Mobile money
            </TabsTrigger>
            <TabsTrigger value="bank_account" className="gap-2">
              <Building2 className="h-4 w-4" /> Bank account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mobile_money" className="space-y-4 pt-4">
            <ProviderSelect
              label="Mobile network"
              placeholder="Select a mobile network (e.g. M-Pesa, Mixx by Yas)"
              providers={filtered}
              value={providerId}
              onChange={setProviderId}
              loading={providersQuery.isLoading}
            />
            <Field label="Account name" value={accountName} onChange={setAccountName} placeholder="e.g. John Mwakapina (as on the SIM)" />
            <Field label="Mobile number" value={phone} onChange={setPhone} placeholder="e.g. 0712 345 678" type="tel" />
            <Field label="Account number" value={accountNumber} onChange={setAccountNumber} placeholder="e.g. 0712345678 (same as mobile number)" />
          </TabsContent>

          <TabsContent value="bank_account" className="space-y-4 pt-4">
            <ProviderSelect
              label="Bank"
              placeholder="Select your bank (e.g. CRDB, NMB, NBC)"
              providers={filtered}
              value={providerId}
              onChange={setProviderId}
              loading={providersQuery.isLoading}
            />
            <Field label="Account holder name" value={accountName} onChange={setAccountName} placeholder="e.g. John Mwakapina (as on bank statement)" />
            <Field label="Account number" value={accountNumber} onChange={setAccountNumber} placeholder="e.g. 0150123456789" />
            <Field label="Branch (optional)" value={bankBranch} onChange={setBankBranch} placeholder="e.g. Mwanza Branch" />
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Set as default</p>
            <p className="text-xs text-muted-foreground">Used for all payouts unless changed.</p>
          </div>
          <Switch checked={setDefault} onCheckedChange={setSetDefault} />
        </div>

        <Button onClick={handleSubmit} disabled={submitting} size="lg" className="w-full">
          {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : profile ? "Save changes" : "Add payout method"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} />
  </div>
);

const ProviderSelect = ({
  label,
  placeholder,
  providers,
  value,
  onChange,
  loading,
}: {
  label: string;
  placeholder: string;
  providers: PaymentProvider[];
  value: string;
  onChange: (v: string) => void;
  loading: boolean;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    <Select value={value} onValueChange={onChange} disabled={loading || !providers.length}>
      <SelectTrigger className="h-10">
        <SelectValue
          placeholder={
            loading
              ? "Loading…"
              : !providers.length
              ? "No providers available for your country"
              : placeholder
          }
        />
      </SelectTrigger>
      <SelectContent>
        {providers.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <div className="flex flex-col">
              <span className="font-medium">{p.name ?? p.display_name ?? p.code}</span>
              <span className="text-[10px] text-muted-foreground uppercase">{p.code}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {!loading && !providers.length && (
      <p className="text-[11px] text-muted-foreground">
        Contact support to add a {label.toLowerCase()} for your country.
      </p>
    )}
  </div>
);

export default PaymentSetupModal;
