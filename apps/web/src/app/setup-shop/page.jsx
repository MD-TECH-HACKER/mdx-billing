import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Store, Upload, ArrowRight, IndianRupee } from "lucide-react";
import useUser from "@/utils/useUser";
import useUpload from "@/utils/useUpload";
import { AppLoader } from "@/components/ui";

export default function SetupShopPage() {
  const { data: user, loading: userLoading } = useUser();
  const [upload, { loading: uploading }] = useUpload();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopDescription, setShopDescription] = useState("");
  const [shopLogo, setShopLogo] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [shopChecking, setShopChecking] = useState(true);

  useEffect(() => {
    if (!userLoading && !user) {
      window.location.href = "/account/signin?callbackUrl=/setup-shop";
    }
  }, [user, userLoading]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/shop")
      .then((r) => r.json())
      .then((d) => {
        if (d.shop) {
          navigate("/dashboard", { replace: true });
          return;
        }
        setShopChecking(false);
      })
      .catch(() => setShopChecking(false));
    // also fetch profile to prefill display name
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile)
          setDisplayName(d.profile.displayName || d.profile.name || "");
      })
      .catch(() => {});
  }, [user, navigate]);

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Only PNG, JPG, WEBP allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Max 5MB");
      return;
    }
    const { url, error: upErr } = await upload({ file });
    if (upErr) {
      setError(upErr);
      return;
    }
    setShopLogo(url);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!shopName.trim()) {
      setError("Shop name is required");
      return;
    }
    setSaving(true);
    try {
      const promises = [
        fetch("/api/shop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopName,
            shopDescription,
            shopLogo,
            address,
            phone,
          }),
        }),
      ];
      if (displayName.trim()) {
        promises.push(
          fetch("/api/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ displayName: displayName.trim() }),
          }),
        );
      }
      const results = await Promise.all(promises);
      if (!results[0].ok) throw new Error("Failed to save shop");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error(err);
      setError("Could not save shop. Try again.");
      setSaving(false);
    }
  };

  if (userLoading || !user || shopChecking) {
    return <AppLoader fullScreen label="Checking your shop..." />;
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center px-4 py-10 font-inter">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]" />
        <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-violet-600/40 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-fuchsia-500/30 blur-3xl" />
      </div>

      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg rounded-3xl bg-white/10 backdrop-blur-2xl border border-white/20 p-6 md:p-8 shadow-2xl"
      >
        <div className="text-center mb-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-xl mb-4">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-white text-2xl font-bold font-poppins">
            Setup your shop
          </h1>
          <p className="text-white/60 text-sm mt-1">
            Just a few details to get you started
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-white/60 bg-white/10 border border-white/15 px-2.5 py-1 rounded-full">
            <IndianRupee className="w-3 h-3" />
            Default currency is INR — change anytime in Settings
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col items-center">
            <label className="cursor-pointer group">
              <div className="w-24 h-24 rounded-2xl bg-white/10 border-2 border-dashed border-white/30 flex items-center justify-center overflow-hidden hover:border-violet-400 transition">
                {shopLogo ? (
                  <img
                    src={shopLogo}
                    alt="logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Upload className="w-6 h-6 text-white/50 group-hover:text-violet-300" />
                )}
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleLogo}
              />
            </label>
            <span className="text-white/50 text-xs mt-2">
              {uploading ? "Uploading..." : "Optional shop logo"}
            </span>
          </div>

          <div>
            <label className="block text-white/80 text-xs mb-1.5">
              Your name *
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-400"
              placeholder="How should we call you?"
            />
          </div>

          <div>
            <label className="block text-white/80 text-xs mb-1.5">
              Shop name *
            </label>
            <input
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              maxLength={100}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-400"
              placeholder="My Awesome Shop"
            />
          </div>

          <div>
            <label className="block text-white/80 text-xs mb-1.5">
              Shop description
            </label>
            <textarea
              value={shopDescription}
              onChange={(e) => setShopDescription(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-400 resize-none"
              placeholder="What's your shop about?"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-white/80 text-xs mb-1.5">
                Address
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={300}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-400"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-white/80 text-xs mb-1.5">
                Phone
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={50}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-400"
                placeholder="Optional"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-xl bg-red-500/20 border border-red-400/40 text-red-100 text-sm px-4 py-3">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90 text-white rounded-2xl px-4 py-3.5 font-semibold flex items-center justify-center gap-2 transition shadow-lg disabled:opacity-60"
          >
            {saving ? "Saving..." : "Continue to Dashboard"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
