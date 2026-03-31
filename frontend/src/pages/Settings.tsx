import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { orgApi, membersApi, Organization, OrgMember } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import {
    Building2, Users, UserPlus, Loader2, Save,
    Crown, UserCog, Trash2, Eye, EyeOff
} from "lucide-react";

const ROLE_ICONS: Record<string, React.ReactNode> = {
    Owner: <Crown className="w-4 h-4 text-yellow-500" />,
    Supervisor: <UserCog className="w-4 h-4 text-blue-500" />,
};

export default function Settings() {
    const { user, isOwner } = useAuth();
    const { toast } = useToast();

    // Org details
    const [org, setOrg] = useState<Organization | null>(null);
    const [orgForm, setOrgForm] = useState({ name: "", industry: "", phone: "", address: "" });
    const [isSavingOrg, setIsSavingOrg] = useState(false);

    // Members
    const [members, setMembers] = useState<OrgMember[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(true);

    // Add Supervisor form
    const [supervisorName, setSupervisorName] = useState("");
    const [supervisorEmail, setSupervisorEmail] = useState("");
    const [supervisorPassword, setSupervisorPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<OrgMember | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [orgData, membersData] = await Promise.all([
                orgApi.getMyOrg(),
                membersApi.list(),
            ]);
            setOrg(orgData);
            setOrgForm({
                name: orgData.name || "",
                industry: orgData.industry || "",
                phone: orgData.phone || "",
                address: orgData.address || "",
            });
            setMembers(membersData);
        } catch (err) {
            console.error("Failed to load settings:", err);
        } finally {
            setIsLoading(false);
            setIsLoadingMembers(false);
        }
    };

    const handleSaveOrg = async () => {
        setIsSavingOrg(true);
        try {
            const updated = await orgApi.update(orgForm);
            setOrg(updated);
        } catch (err) {
            console.error("Failed to update org:", err);
        } finally {
            setIsSavingOrg(false);
        }
    };

    const handleAddSupervisor = async () => {
        if (!supervisorName.trim() || !supervisorEmail.trim() || !supervisorPassword.trim()) return;
        if (supervisorPassword.length < 6) {
            toast({
                title: "Error",
                description: "Password must be at least 6 characters",
                variant: "destructive",
            });
            return;
        }
        setIsAdding(true);
        try {
            await membersApi.invite(supervisorEmail.trim(), "Supervisor", supervisorName.trim(), supervisorPassword);
            toast({
                title: "Supervisor Added",
                description: `${supervisorName} has been added successfully.`,
            });
            setSupervisorName("");
            setSupervisorEmail("");
            setSupervisorPassword("");
            // Refresh members list
            const refreshed = await membersApi.list();
            setMembers(refreshed);
        } catch (err: any) {
            toast({
                title: "Error",
                description: err.message || "Failed to add supervisor",
                variant: "destructive",
            });
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemoveMember = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await membersApi.remove(deleteTarget.uid);
            setMembers((prev) => prev.filter((m) => m.uid !== deleteTarget.uid));
            setDeleteTarget(null);
        } catch (err) {
            console.error("Failed to remove member:", err);
        } finally {
            setIsDeleting(false);
        }
    };

    // Filter to only show supervisors (non-Owner members)
    const supervisors = members.filter((m) => m.role !== "Owner");

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="pb-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8">
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>

            {/* Organization Details */}
            <div className="card-elevated p-6">
                <div className="flex items-center gap-2 mb-6">
                    <Building2 className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Organization</h2>
                    {org?.plan && (
                        <span className="ml-auto text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium uppercase">
                            {org.plan} plan
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="form-label">Name</label>
                        <input
                            type="text"
                            value={orgForm.name}
                            onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                            className="form-field"
                            disabled={!isOwner}
                        />
                    </div>
                    <div>
                        <label className="form-label">Industry</label>
                        <input
                            type="text"
                            value={orgForm.industry}
                            onChange={(e) => setOrgForm({ ...orgForm, industry: e.target.value })}
                            className="form-field"
                            disabled={!isOwner}
                        />
                    </div>
                    <div>
                        <label className="form-label">Phone</label>
                        <input
                            type="tel"
                            value={orgForm.phone}
                            onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
                            className="form-field"
                            disabled={!isOwner}
                        />
                    </div>
                    <div>
                        <label className="form-label">Address</label>
                        <input
                            type="text"
                            value={orgForm.address}
                            onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                            className="form-field"
                            disabled={!isOwner}
                        />
                    </div>
                </div>

                {isOwner && (
                    <div className="mt-4 flex justify-end">
                        <Button onClick={handleSaveOrg} disabled={isSavingOrg}>
                            {isSavingOrg ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Save Changes
                        </Button>
                    </div>
                )}
            </div>

            {/* Add Supervisor */}
            {isOwner && (
                <div className="card-elevated p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <UserPlus className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">Add Supervisor</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Name</label>
                            <input
                                type="text"
                                value={supervisorName}
                                onChange={(e) => setSupervisorName(e.target.value)}
                                placeholder="Supervisor name"
                                className="form-field"
                            />
                        </div>
                        <div>
                            <label className="form-label">Email</label>
                            <input
                                type="email"
                                value={supervisorEmail}
                                onChange={(e) => setSupervisorEmail(e.target.value)}
                                placeholder="supervisor@example.com"
                                className="form-field"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="form-label">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={supervisorPassword}
                                    onChange={(e) => setSupervisorPassword(e.target.value)}
                                    placeholder="Min 6 characters"
                                    className="form-field pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center gap-4">
                        <Button
                            onClick={handleAddSupervisor}
                            disabled={isAdding || !supervisorName.trim() || !supervisorEmail.trim() || !supervisorPassword.trim()}
                        >
                            {isAdding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                            Add Supervisor
                        </Button>
                    </div>
                </div>
            )}

            {/* Supervisors List */}
            <div className="card-elevated p-6">
                <div className="flex items-center gap-2 mb-6">
                    <Users className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Supervisors</h2>
                    <span className="ml-auto text-sm text-muted-foreground">{supervisors.length} supervisor{supervisors.length !== 1 ? "s" : ""}</span>
                </div>

                {isLoadingMembers ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : supervisors.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <UserCog className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No supervisors added yet</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {supervisors.map((member) => (
                            <div
                                key={member.uid}
                                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {ROLE_ICONS.Supervisor}
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-foreground truncate">
                                            {member.name || member.email || "Unknown"}
                                        </div>
                                        {member.email && member.name && (
                                            <div className="text-xs text-muted-foreground mb-0.5">
                                                {member.email}
                                            </div>
                                        )}
                                        <div className="text-xs text-muted-foreground">
                                            Added {new Date(member.joined_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>

                                {isOwner && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive shrink-0"
                                        onClick={() => setDeleteTarget(member)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Delete Member Confirmation */}
            <DeleteConfirmDialog
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleRemoveMember}
                title="Remove Supervisor"
                description={`Are you sure you want to remove ${deleteTarget?.name || deleteTarget?.email}? They will lose access to the system.`}
                isDeleting={isDeleting}
            />
        </div>
    );
}
