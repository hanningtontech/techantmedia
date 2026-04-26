import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";

export default function StudentDisabledPage() {
  const { loading, profile, signOut } = useFirebaseAuth();
  if (loading) {
    return <div className="container py-12 text-muted-foreground">Loading…</div>;
  }
  return (
    <div className="nclex-app mx-auto max-w-lg px-4 py-16">
      <Card className="nclex-card border-amber-200">
        <CardHeader>
          <CardTitle>Account temporarily disabled</CardTitle>
          <CardDescription>
            This account is temporarily disabled. Please contact your administrator if you believe this is a mistake.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
          {profile?.email ? <span className="text-xs text-muted-foreground">{profile.email}</span> : null}
        </CardContent>
      </Card>
    </div>
  );
}

