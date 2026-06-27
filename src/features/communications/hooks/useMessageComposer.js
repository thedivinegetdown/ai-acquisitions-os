import { useCallback, useState } from "react";
import { getErrorMessage } from "../../../utils/errors";
import {
  COMPOSER_CHANNELS,
  buildDraftMessage,
  createInternalNote,
  logCallFromComposer,
  prepareEmailDraftFromComposer,
  prepareFutureCommunication,
  sendSmsFromComposer,
} from "../services";

export function useMessageComposer({
  phone,
  deal = null,
  onLocalEvent,
  onSent,
} = {}) {
  const [draft, setDraft] = useState(() =>
    buildDraftMessage({
      channel: COMPOSER_CHANNELS.SMS,
      to: phone || deal?.phone || "",
    })
  );
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  const updateDraft = useCallback((updates) => {
    setDraft((current) => ({
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const resetDraft = useCallback(
    (channel = draft.channel) => {
      setDraft(
        buildDraftMessage({
          channel,
          to: phone || deal?.phone || "",
        })
      );
    },
    [deal?.phone, draft.channel, phone]
  );

  const submitDraft = useCallback(async () => {
    setSending(true);
    setStatusMessage("");
    setError("");

    try {
      if (draft.channel === COMPOSER_CHANNELS.NOTE) {
        const noteResult = createInternalNote({
          body: draft.body,
          deal,
          phone: phone || deal?.phone || "",
        });

        if (!noteResult.success) {
          throw new Error(noteResult.error?.message || "Could not add note.");
        }

        onLocalEvent?.(noteResult.data);
        setStatusMessage("Internal note added to the timeline.");
        resetDraft(COMPOSER_CHANNELS.NOTE);
        return noteResult;
      }

      if (draft.channel === COMPOSER_CHANNELS.SMS) {
        const smsResult = await sendSmsFromComposer({
          to: draft.to || phone || deal?.phone || "",
          body: draft.body,
          logLocally: true,
        });

        if (!smsResult.success) {
          throw new Error(smsResult.error?.message || "Could not send SMS.");
        }

        setStatusMessage("SMS sent and logged.");
        resetDraft(COMPOSER_CHANNELS.SMS);
        onSent?.();
        return smsResult;
      }

      if (draft.channel === COMPOSER_CHANNELS.EMAIL) {
        const emailResult = await prepareEmailDraftFromComposer({
          to: draft.to,
          subject: draft.subject,
          body: draft.body,
          deal,
        });

        if (!emailResult.success) {
          throw new Error(
            emailResult.error?.message || "Could not prepare email draft."
          );
        }

        onLocalEvent?.(emailResult.data.event);
        setStatusMessage(emailResult.data.message);
        resetDraft(COMPOSER_CHANNELS.EMAIL);
        return emailResult;
      }

      if (draft.channel === COMPOSER_CHANNELS.CALL) {
        const callResult = await logCallFromComposer({
          to: draft.to || phone || deal?.phone || "",
          outcome: draft.outcome,
          notes: draft.body,
          nextCallDate: draft.nextCallDate,
          deal,
        });

        if (!callResult.success) {
          throw new Error(
            callResult.error?.message || "Could not log call notes."
          );
        }

        onLocalEvent?.(callResult.data.event);
        setStatusMessage(callResult.data.message);
        resetDraft(COMPOSER_CHANNELS.CALL);
        return callResult;
      }

      const futureResult = prepareFutureCommunication({
        channel: draft.channel,
        body: draft.body,
        deal,
        phone: phone || deal?.phone || "",
      });

      setStatusMessage(futureResult.data.message);
      resetDraft(draft.channel);
      return futureResult;
    } catch (submitError) {
      const message = getErrorMessage(submitError, "Could not prepare communication.");
      setError(message);
      return {
        success: false,
        error: { message, cause: submitError },
      };
    } finally {
      setSending(false);
    }
  }, [deal, draft, onLocalEvent, onSent, phone, resetDraft]);

  return {
    draft,
    updateDraft,
    submitDraft,
    resetDraft,
    sending,
    statusMessage,
    error,
  };
}
