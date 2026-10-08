import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { api, ApiError, putAvatarFile } from "../lib/api";
import { Avatar } from "../components/Avatar";
import { AvatarCropper } from "../components/AvatarCropper";
import { encodeAvatar, loadPicture, NO_CROP, type Crop, type Loaded } from "../lib/avatar-image";
import { setProfile, useProfile } from "../lib/profile";
import { toast } from "../lib/toast";
import { useDelayed } from "../lib/useDelayed";

/**
 * `/app/profile`, in the star HUD (PROFILES, 8 Oct 2026; docs/PROFILES-PLAN.md;
 * design/templates/web/profile/SPEC.md). Starfield's character menu: the
 * person in a ring, panels of read-only facts around it.
 *
 * `DESIGN-MANDATE.md` §1: a control exists only if pressing it changes what the
 * student knows, can do, or can see. The controls:
 *
 *   Choose a picture   opens the file picker; nothing is sent yet
 *   Position + Zoom    what the circle shows is exactly what will be sent
 *   Use this picture   the one that sends it: classmates and teachers see it at
 *                      once (DESIGN-MANDATE §4 is reversed for this, 7 Oct)
 *   Choose another     back to the picker with the same stage
 *   Cancel             nothing was sent
 *   Remove picture     the generated planet comes back; choose again any time
 *
 * Name, number, section and classes are read-only: the roster owns them. A
 * picture a teacher removed is said so, once, with the day.
 */

type Step = { kind: "idle" } | { kind: "crop"; pic: Loaded; crop: Crop; saving: boolean };

/**
 * "Choose a picture": a visible button-shaped label that WRAPS the real file
 * input, so the input is the control (a Tab stop, announced with the label's
 * words, Enter or Space opens the picker) and the label shows its focus. Chat's
 * Attach is built the same way.
 */
function Picker({
  children,
  onPick,
  className = "",
  disabled = false,
}: {
  children: string;
  onPick: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  disabled?: boolean;
}): JSX.Element {
  return (
    <label className={`hud-button prof-pick ${className}`.trim()} aria-disabled={disabled || undefined}>
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
      const up = await api.profileAvatarUpload(blob.size);
      await putAvatarFile(up.uploadUrl, blob);
      setProfile(await api.profileAvatarSet(up.path));
      pic.bitmap.close();
      setStep({ kind: "idle" });
      toast.success("Your picture is set", "Your classmates and your teachers can see it now.");
    } catch (err) {
      // Back to the stage with the crop kept, so nothing the student did is lost.
      setStep({ kind: "crop", pic, crop, saving: false });
      const msg =
        err instanceof ApiError || err instanceof Error ? err.message : "Could not reach the server. Try again.";
      toast.error("Your picture was not saved", msg);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      setProfile(await api.profileAvatarRemove());
      toast.success("Your picture is removed", "Your system's planet shows instead. You can choose a new one any time.");
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
    <section className="set prof" data-profile="" aria-labelledby="prof-title">
      <header className="set-head">
        <h1 id="prof-title" className="set-title">
          Your profile
        </h1>
        <p className="set-sub">Who your class and your teachers see. Your name and number come from the roster.</p>
      </header>

      {failed && !profile ? (
        <div className="hud-panel prof-state" role="alert">
          <div className="set-body">
            <p className="set-note">Your profile could not be loaded. Nothing was changed.</p>
            <button type="button" className="hud-button" onClick={reload}>
              Try again
            </button>
          </div>
        </div>
      ) : !profile ? (
        <div className="prof-grid" aria-busy="true" data-loading="">
          {slow && (
            <p className="sr-only" role="status">
              {waking ? "The server is waking up. This can take up to a minute." : "Loading your profile."}
            </p>
          )}
          <div className="hud-panel prof-skel prof-picture">
            <div className="skel prof-skel-ring" />
          </div>
          <div className="hud-panel prof-skel">
            <div className="skel skel-line" />
            <div className="skel skel-line" />
          </div>
          <div className="hud-panel prof-skel">
            <div className="skel skel-line" />
          </div>
        </div>
      ) : (
        <div className="prof-grid">
          <section className="hud-panel set-panel prof-picture" aria-labelledby="prof-pic-title">
            <h2 id="prof-pic-title" className="hud-caption">
              Picture
            </h2>
            <div className="set-body prof-pic-body">
              {step.kind === "crop" ? (
                <AvatarCropper pic={step.pic} crop={step.crop} onChange={(crop) => setStep({ ...step, crop })} />
              ) : (
                <div className="prof-ring" data-ring="">
                  <Avatar avatar={profile.avatar} size="xl" />
                </div>
              )}

              {profile.removedAt && !profile.hasPicture && step.kind === "idle" && (
                <p className="prof-notice" role="status" data-removed="">
                  Your picture was removed by your teacher on {day(profile.removedAt)}. Choose a new one when you are
                  ready.
                </p>
              )}

              {!profile.pictures ? (
                <p className="set-note">
                  Pictures are not switched on for this server, so your system draws yours from your student ID.
                </p>
              ) : (
                <>
                  <div className="prof-actions">
                    {step.kind === "idle" && (
                      <>
                        <Picker className="button-primary" onPick={choose}>
                          {profile.hasPicture ? "Choose another picture" : "Choose a picture"}
                        </Picker>
                        {profile.hasPicture && (
                          <button type="button" className="hud-button" onClick={remove} disabled={removing}>
                            {removing ? "Removing…" : "Remove picture"}
                          </button>
                        )}
                      </>
                    )}
                    {step.kind === "crop" && (
                      <>
                        <button type="button" className="hud-button button-primary" onClick={use} disabled={step.saving}>
                          {step.saving ? "Saving…" : "Use this picture"}
                        </button>
                        <Picker disabled={step.saving} onPick={choose}>
                          Choose another
                        </Picker>
                        <button type="button" className="hud-button" onClick={cancel} disabled={step.saving}>
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                  <p className="set-note">
                    {step.kind === "idle"
                      ? profile.hasPicture
                        ? "Your classmates and your teachers see this picture. Your teacher can remove it."
                        : "Until you choose one, your system draws yours from your student ID. A picture is seen by your classmates and your teachers, and your teacher can remove it."
                      : "Drag the picture or use the arrow keys, then zoom. The circle is what others see. It is sent as a 512-pixel square and your phone's location data is not."}
                  </p>
                </>
              )}
            </div>
          </section>

          <div className="prof-side">
          <section className="hud-panel set-panel" aria-labelledby="prof-who-title">
            <h2 id="prof-who-title" className="hud-caption">
              Who you are
            </h2>
            <dl className="set-body prof-facts">
              <div>
                <dt>Name</dt>
                <dd>{profile.name}</dd>
              </div>
              {profile.studentId && (
                <div>
                  <dt>Student number</dt>
                  <dd className="mono" data-student-id="">
                    {profile.studentId}
                  </dd>
                </div>
              )}
              {profile.section && (
                <div>
                  <dt>Section</dt>
                  <dd>{profile.section}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="hud-panel set-panel" aria-labelledby="prof-classes-title">
            <h2 id="prof-classes-title" className="hud-caption">
              Your classes
            </h2>
            <div className="set-body">
              {profile.classes.length === 0 ? (
                <p className="set-note">You are not in a class yet. Your teacher adds your section to one.</p>
              ) : (
                <ul className="prof-classes">
                  {profile.classes.map((c) => (
                    <li key={`${c.subject}-${c.section}-${c.term}`}>
                      <span className="prof-class-code mono">{c.subject}</span>
                      <span className="prof-class-title">{c.subjectTitle}</span>
                      <span className="prof-class-meta">
                        {c.section} · {c.term}
                        {c.teacher ? ` · ${c.teacher}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          </div>
        </div>
      )}
    </section>
  );
}
