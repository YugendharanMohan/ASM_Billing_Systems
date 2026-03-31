import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { orgApi } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Building2, ArrowRight, Loader2, Factory, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Onboarding() {
    const { refreshUser } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState("");
    const [formData, setFormData] = useState({
        name: "",
        industry: "Textile / Loom",
        phone: "",
        address: "",
    });

    const handleCreate = async () => {
        if (!formData.name.trim()) {
            setError("Organization name is required");
            return;
        }

        setIsCreating(true);
        setError("");

        try {
            await orgApi.create(formData);
            // Refresh user token to pick up new org_id custom claims
            // Small delay to let Firebase propagate the custom claims
            await new Promise((r) => setTimeout(r, 1500));
            await refreshUser();
            navigate("/dashboard");
        } catch (err: any) {
            setError(err.message || "Failed to create organization");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
            <div className="w-full max-w-lg">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
                        <Building2 className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold text-foreground">Welcome to ASM</h1>
                    <p className="text-muted-foreground mt-2">
                        Register your company to get started as the Owner
                    </p>
                </div>

                {/* Step 1: Org Name */}
                {step === 0 && (
                    <div className="card-elevated p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div>
                            <label className="form-label flex items-center gap-2">
                                <Building2 className="w-4 h-4" /> Organization Name
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Mohan Textiles"
                                className="form-field text-lg"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="form-label flex items-center gap-2">
                                <Factory className="w-4 h-4" /> Industry
                            </label>
                            <input
                                type="text"
                                value={formData.industry}
                                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                                placeholder="Textile / Loom"
                                className="form-field"
                            />
                        </div>

                        <Button
                            className="w-full"
                            size="lg"
                            onClick={() => setStep(1)}
                            disabled={!formData.name.trim()}
                        >
                            Continue <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>

                        <p className="text-xs text-muted-foreground text-center">
                            You'll be registered as the <strong>Owner</strong> with full access. You can add <strong>Supervisors</strong> later from Settings.
                        </p>
                    </div>
                )}

                {/* Step 2: Contact Details + Create */}
                {step === 1 && (
                    <div className="card-elevated p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div>
                            <label className="form-label flex items-center gap-2">
                                <Phone className="w-4 h-4" /> Contact Phone
                                <span className="text-xs text-muted-foreground">(optional)</span>
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="+91 98765 43210"
                                className="form-field"
                            />
                        </div>

                        <div>
                            <label className="form-label flex items-center gap-2">
                                <MapPin className="w-4 h-4" /> Address
                                <span className="text-xs text-muted-foreground">(optional)</span>
                            </label>
                            <textarea
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                placeholder="123 Mill Road, Salem, TN 636001"
                                className="form-field"
                                rows={2}
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setStep(0)}
                                disabled={isCreating}
                            >
                                Back
                            </Button>
                            <Button
                                className="flex-1"
                                size="lg"
                                onClick={handleCreate}
                                disabled={isCreating}
                            >
                                {isCreating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        Create Organization <ArrowRight className="w-4 h-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Progress dots */}
                <div className="flex justify-center gap-2 mt-6">
                    {[0, 1].map((s) => (
                        <div
                            key={s}
                            className={`w-2 h-2 rounded-full transition-colors ${s === step ? "bg-primary" : "bg-muted"
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
