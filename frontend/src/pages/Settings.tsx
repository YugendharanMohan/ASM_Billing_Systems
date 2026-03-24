import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { orgApi, membersApi, Organization, OrgMember } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import {
    Building2, Users, UserPlus, Loader2, Save, Shield,
    Crown, UserCog, Wrench, Trash2, Mail
} from "lucide-react";

const ROLE_ICONS: Record<string, React.ReactNode> = {
    Owner: <Crown className="w-4 h-4 text-yellow-500" />,
    Admin: <Shield className="w-4 h-4 text-blue-500" />,
    Operator: <Wrench className="w-4 h-4 text-muted-foreground" />,
};

export default function Settings() {
    const { user, isOwner, isAdmin } = useAuth();

    // Org details
    const [org, setOrg] = useState<Organization | null>(null);
    const [orgForm, setOrgForm] = useState({ name: "", industry: "", phone: "", address: "" });
    const [isSavingOrg, setIsSavingOrg] = useState(false);

    // Members
    const [members, setMembers] = useState<OrgMember[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(true);

    // Invite
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("Operator");
    const [isInviting, setIsInviting] = useState(false);
    const [inviteMessage, setInviteMessage] = useState("");

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

    const handleInvite = async () => {
        if (!inviteEmail.trim()) return;
        setIsInviting(true);
        setInviteMessage("");
        try {
            const result = await membersApi.invite(inviteEmail.trim(), inviteRole);
            if (result.email_sent) {
                setInviteMessage(`✅ Invited ${inviteEmail} as ${inviteRole} — invitation email sent!`);
            } else {
                setInviteMessage(`✅ Added ${inviteEmail} as ${inviteRole} (email not sent — check SMTP config)`);
            }
            setInviteEmail("");
            setInviteRole("Operator");
            // Refresh members list
            const refreshed = await membersApi.list();
            setMembers(refreshed);
        } catch (err: any) {
            setInviteMessage(`❌ ${err.message}`);
        } finally {
            setIsInviting(false);
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

    const handleRoleChange = async (uid: string, newRole: string) => {
        try {
            await membersApi.updateRole(uid, newRole);
            setMembers((prev) =>
                prev.map((m) => (m.uid === uid ? { ...m, role: newRole } : m))
            );
        } catch (err) {
            console.error("Failed to update role:", err);
        }
    };

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
                            disabled={!isAdmin}
                        />
                    </div>
                    <div>
                        <label className="form-label">Industry</label>
                        <input
                            type="text"
                            value={orgForm.industry}
                            onChange={(e) => setOrgForm({ ...orgForm, industry: e.target.value })}
                            className="form-field"
                            disabled={!isAdmin}
                        />
                    </div>
                    <div>
                        <label className="form-label">Phone</label>
                        <input
                            type="tel"
                            value={orgForm.phone}
                            onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
                            className="form-field"
                            disabled={!isAdmin}
                        />
                    </div>
                    <div>
                        <label className="form-label">Address</label>
                        <input
                            type="text"
                            value={orgForm.address}
                            onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                            className="form-field"
                            disabled={!isAdmin}
                        />
                    </div>
                </div>

                {isAdmin && (
                    <div className="mt-4 flex justify-end">
                        <Button onClick={handleSaveOrg} disabled={isSavingOrg}>
                            {isSavingOrg ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Save Changes
                        </Button>
                    </div>
                )}
            </div>

            {/* Team Members */}
            <div className="card-elevated p-6">
                <div className="flex items-center gap-2 mb-6">
                    <Users className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Team Members</h2>
                    <span className="ml-auto text-sm text-muted-foreground">{members.length} members</span>
                </div>

                {/* Invite Section (Admin/Owner only) */}
                {isAdmin && (
                    <div className="mb-6 p-4 bg-muted/50 rounded-lg space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <UserPlus className="w-4 h-4" /> Invite a team member
                        </div>
                        <div className="flex gap-3 flex-wrap">
                            <div className="flex-1 min-w-[200px]">
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="colleague@example.com"
                                    className="form-field"
                                />
                            </div>
                            <Select value={inviteRole} onValueChange={setInviteRole}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Operator">Operator</SelectItem>
                                    <SelectItem value="Admin">Admin</SelectItem>
                                    <SelectItem value="Owner">Owner</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button onClick={handleInvite} disabled={isInviting || !inviteEmail.trim()}>
                                {isInviting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                                Invite
                            </Button>
                        </div>
                        {inviteMessage && (
                            <div className="text-sm">{inviteMessage}</div>
                        )}
                    </div>
                )}

                {/* Members List */}
                {isLoadingMembers ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="space-y-2">
                        {members.map((member) => (
                            <div
                                key={member.uid}
                                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {ROLE_ICONS[member.role] || ROLE_ICONS.Operator}
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-foreground truncate">
                                            {member.name || member.email || "Unknown Member"}
                                            {member.uid === user?.id && (
                                                <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                                            )}
                                        </div>
                                        {member.email && member.name && (
                                            <div className="text-xs text-muted-foreground mb-0.5">
                                                {member.email}
                                            </div>
                                        )}
                                        <div className="text-xs text-muted-foreground">
                                            Joined {new Date(member.joined_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>

                                {/* Role selector (Owner only, can't change own role) */}
                                {isOwner && member.role !== "Owner" && member.uid !== user?.id ? (
                                    <div className="flex items-center gap-2">
                                        <Select
                                            value={member.role}
                                            onValueChange={(val) => handleRoleChange(member.uid, val)}
                                        >
                                            <SelectTrigger className="w-[120px] h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Operator">Operator</SelectItem>
                                                <SelectItem value="Admin">Admin</SelectItem>
                                                <SelectItem value="Owner">Owner</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => setDeleteTarget(member)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <span className="text-xs font-medium px-2 py-1 rounded bg-muted text-muted-foreground">
                                        {member.role}
                                    </span>
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
                title="Remove Team Member"
                description={`Are you sure you want to remove ${deleteTarget?.name || deleteTarget?.email} from the organization? They will lose access to all data.`}
                isDeleting={isDeleting}
            />
        </div>
    );
}
