# Implementation Plan - Refined Fun Mode & Auto-Termination

The user wants to refine the "Fun Mode" UI by reducing the size of central elements and adding more vertical spacing. Additionally, the "Fun Mode" (Debate) should automatically end when the AI finishes speaking all generated responses.

## UI Refinements
1.  **Reduce Scaling**: Decrease the logo/hero character size in both Home and Fun modes to reveal more of the background.
2.  **Increase Spacing**: Add vertical margins between the Hero visual, the Command Console, and the Input Bar to prevent a "cramped" look.
3.  **Tighten Console**: Ensure the agent toggles and input bar are a cohesive unit with proper internal padding but clear separation from the characters above.

## Auto-Termination Logic
1.  **Monitor Conversation Completion**: Implement a check in the frontend to detect when:
    *   `isProcessing` is true (Fun Mode active).
    *   The backend stream has finished sending segments.
    *   The `audioQueue` is empty and the last segment has finished playing.
2.  **Trigger `stopDebate`**: Once the end-of-conversation is detected, automatically call the function to return to the Home view.

## Verification
- Start Fun Mode and ensure the layout looks spacious and balanced.
- Allow the AI to finish its discussion and verify it returns to the Home view automatically.
