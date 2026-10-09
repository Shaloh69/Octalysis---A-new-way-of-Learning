import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { ApiError, profileAvatarRemove, profileAvatarSet, profileAvatarUpload, putAvatarFile } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { AvatarCropper } from "@/components/AvatarCropper";
import { encodeAvatar, loadPicture, NO_CROP, type Crop, type Loaded } from "@/lib/avatar-image";
import { setProfile, useProfile } from "@/lib/profile";
import type { Identity } from "@/lib/session";
import { useDelayed } from "@/lib/useDelayed";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * `/profile`: a teacher's or the admin's own page (PROFILES, 9 Oct 2026;
 * docs/PROFILES-PLAN.md; design/templates/console/profile/SPEC.md). Title and a
 * sentence over a rule, then cards, as shadcn-admin's Settings > Profile.
 *
 * `DESIGN-MANDATE.md` §1: a control exists only if pressing it changes what the
 * person knows, can do, or can see. The controls, as the student's page has them:
 *
 *   Choose a picture   opens the file picker; nothing is sent yet
 *   Position + Zoom    what the circle shows is exactly what will be sent
 *   Use this picture   the one that sends it: students and staff see it at once
 *   Choose another     back to the picker with the same stage
 *   Cancel             nothing was sent
 *   Remove picture     the generated planet comes back; choose again any time
 *
 * Name, role, Employee ID, email and classes are read-only: the roster and the
 * admin own them. A picture the admin removed is said so, once, with the day.
 */

type Step = { kind: "idle" } | { kind: "crop"; pic: Loaded; crop: Crop; saving: boolean };

/**
 * "Choose a picture": a button-shaped label that WRAPS the real file input, so
 * the input is the control (a Tab stop, announced with the label's words, Enter
 * or Space opens the picker) and the label shows its focus.
 */
function Picker({
  children,
  onPick,
  primary = false,
  disabled = false,
}: {
  children: string;
  onPick: (e: ChangeEvent<HTMLInputElement>) => void;
  primary?: boolean;
  disabled?: boolean;
}): JSX.Element {
  return (
    <label
      className={cn(buttonVariants({ variant: primary ? "default" : "outline" }), "prof-pick cursor-pointer")}
      aria-disabled={disabled || undefined}
    >
      {children}
      <input
        type="file"
        className="sr-only"
        accept="image/png,image/jpeg,image/webp,image/gif"
        disabled={disabled}
        onChange={onPick}
      />
    </label>
  );
}

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export function ProfilePage(): JSX.Element {
  const me = useOutletContext<Identity>();
  const { profile, loading, failed, reload } = useProfile();
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [removing, setRemoving] = useState(false);
  const slow = useDelayed(loading && !profile, 400);
  const waking = useDelayed(loading && !profile, 3000);

  // Leaving the page with a picture half-positioned drops it; the bitmap is freed
  // once, on unmount (not on every drag, which makes a new `step` each time).
  const held = useRef<Loaded | null>(null);
  held.current = step.kind === "crop" ? step.pic : null;
  useEffect(() => () => held.current?.bitmap.close(), []);

  const choose = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // choosing the same file again must still fire
    if (!f) return;
    try {
      const pic = await loadPicture(f);
      held.current?.bitmap.close(); // "Choose another" replaces the one on the stage
      setStep({ kind: "crop", pic, crop: NO_CROP, saving: false });
    } catch (err) {
      toast.error("That picture was not opened", err instanceof Error ? err.message : "Choose another.");
    }
  };

  const use = async () => {
    if (step.kind !== "crop") return;
    const { pic, crop } = step;
    setStep({ ...step, saving: true });
    try {
      const blob = await encodeAvatar(pic, crop);
      const up = await profileAvatarUpload(blob.size);
      await putAvatarFile(up.uploadUrl, blob);
      setProfile(await profileAvatarSet(up.path));
      pic.bitmap.close();
      setStep({ kind: "idle" });
      toast.success("Your picture is set", "Students and staff can see it now.");
    } catch (err) {
      // Back to the stage with the crop kept, so nothing the person did is lost.
      setStep({ kind: "crop", pic, crop, saving: false });
      const msg =
        err instanceof ApiError || err instanceof Error ? err.message : "Could not reach the server. Try again.";
      toast.error("Your picture was not saved", msg);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      setProfile(await profileAvatarRemove());
      toast.success("Your picture is removed", "A generated planet shows instead. You can choose a new one any time.");
    } catch (err) {
      toast.error("Your picture was not removed", err instanceof ApiError ? err.message : "Could not reach the server. Try again.");
    } finally {
      setRemoving(false);
    }
  };

  const cancel = () => {
    if (step.kind === "crop") step.pic.bitmap.close();
    setStep({ kind: "idle" });
  };

  return (
    <div className="prof" data-profile="">
      <header className="prof-head">
        <h1 className="font-display text-2xl text-ink">Your profile</h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Who your students and the other staff see. Your name, role and employee ID come from the teacher roster.
        </p>
      </header>

      {failed && !profile ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-ink">Your profile could not be loaded. Nothing was changed.</p>
          <Button size="sm" variant="outline" onClick={reload}>Try again</Button>
        </div>
      ) : !profile ? (
        <div className="prof-grid" aria-busy="true" data-loading="">
          {slow && (
            <p className="sr-only" role="status">
              {waking ? "The server is waking up. This can take up to a minute." : "Loading your profile."}
            </p>
          )}
          <Card className="prof-picture"><CardContent className="pt-5"><span className="skeleton-bar prof-skel-ring" /></CardContent></Card>
          <div className="prof-side">
            <Card><CardContent className="pt-5"><span className="skeleton-bar w-40" /></CardContent></Card>
            <Card><CardContent className="pt-5"><span className="skeleton-bar w-56" /></CardContent></Card>
          </div>
        </div>
      ) : (
        <div className="prof-grid">
          <Card className="prof-picture" aria-labelledby="prof-pic-title" role="region">
            <CardHeader>
              <CardTitle id="prof-pic-title">Picture</CardTitle>
              <CardDescription>
                {step.kind === "idle"
                  ? profile.hasPicture
                    ? "Every student you teach, the other teachers and the admin see this picture. The admin can remove it."
                    : "Until you choose one, a planet is drawn for you. A picture is seen by every student you teach, the other teachers and the admin, and the admin can remove it."
                  : "Drag the picture or use the arrow keys, then zoom. The circle is what others see. It is sent as a 512-pixel square and your phone's location data is not."}
              </CardDescription>
            </CardHeader>
            <CardContent className="prof-pic-body">
              {step.kind === "crop" ? (
                <AvatarCropper pic={step.pic} crop={step.crop} onChange={(crop) => setStep({ ...step, crop })} />
              ) : (
                <div className="prof-ring" data-ring="">
                  <Avatar avatar={profile.avatar} size="xl" />
                </div>
              )}

              {profile.removedAt && !profile.hasPicture && step.kind === "idle" && (
                <p className="prof-notice" role="status" data-removed="">
                  Your picture was removed by the admin on {day(profile.removedAt)}. Choose a new one when you are ready.
                </p>
              )}

              {!profile.pictures ? (
                <p className="text-sm text-ink-muted">
                  Pictures are not switched on for this server, so a planet is drawn for you instead.
                </p>
              ) : (
                <div className="prof-actions">
                  {step.kind === "idle" && (
                    <>
                      <Picker primary onPick={choose}>
                        {profile.hasPicture ? "Choose another picture" : "Choose a picture"}
                      </Picker>
                      {profile.hasPicture && (
                        <Button variant="outline" onClick={remove} disabled={removing}>
                          {removing ? "Removing…" : "Remove picture"}
                        </Button>
                      )}
                    </>
                  )}
                  {step.kind === "crop" && (
                    <>
                      <Button onClick={use} disabled={step.saving}>
                        {step.saving ? "Saving…" : "Use this picture"}
                      </Button>
                      <Picker disabled={step.saving} onPick={choose}>
                        Choose another
                      </Picker>
                      <Button variant="outline" onClick={cancel} disabled={step.saving}>
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="prof-side">
            <Card role="region" aria-labelledby="prof-who-title">
              <CardHeader>
                <CardTitle id="prof-who-title">Who you are</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="prof-facts">
                  <div>
                    <dt>Name</dt>
                    <dd>{profile.name}</dd>
                  </div>
                  <div>
                    <dt>Role</dt>
                    <dd>{profile.role === "admin" ? "Admin" : "Teacher"}</dd>
                  </div>
                  <div>
                    <dt>Employee ID</dt>
                    <dd className="num" data-employee-id="">
                      {profile.employeeId ?? <span className="font-body text-ink-muted">Not on the roster</span>}
                    </dd>
                  </div>
                  {me.email && (
                    <div>
                      <dt>Email</dt>
                      <dd className="break-words">{me.email}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            <Card role="region" aria-labelledby="prof-classes-title">
              <CardHeader>
                <CardTitle id="prof-classes-title">Your classes</CardTitle>
              </CardHeader>
              <CardContent>
                {profile.classes.length === 0 ? (
                  <p className="text-sm text-ink-muted">You hold no class yet. The admin assigns one on Teachers.</p>
                ) : (
                  <ul className="prof-classes">
                    {profile.classes.map((c) => (
                      <li key={`${c.subject}-${c.section}-${c.term}`}>
                        <span className="num text-sm text-ink">{c.subject}</span>
                        <span className="text-sm text-ink">{c.subjectTitle}</span>
                        <span className="text-xs text-ink-muted">
                          {c.section} · {c.term}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
