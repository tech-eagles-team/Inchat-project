import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useCallStore = create(
    persist(
        (set, get) => ({
            activeCall: null,
            callHistory: [],
            isInCall: false,
            callType: null, // 'audio' or 'video'
            participants: [],
            callDuration: 0,
            callStatus: 'idle', // 'idle', 'ringing', 'connected', 'ended'

            // Set active call
            setActiveCall: (call) => set({ activeCall: call, isInCall: !!call }),

            // Start a call
            startCall: (callData) => set((state) => ({
                activeCall: callData,
                isInCall: true,
                callStatus: 'ringing',
                callType: callData.type,
                participants: callData.participants || [],
                callDuration: 0
            })),

            // End call
            endCall: () => set((state) => ({
                activeCall: null,
                isInCall: false,
                callStatus: 'ended',
                callDuration: 0,
                participants: []
            })),

            // Update call status
            updateCallStatus: (status) => set({ callStatus: status }),

            // Add participant
            addParticipant: (participant) => set((state) => ({
                participants: [...state.participants, participant]
            })),

            // Remove participant
            removeParticipant: (participantId) => set((state) => ({
                participants: state.participants.filter(p => p.id !== participantId)
            })),

            // Update call duration
            setCallDuration: (duration) => set({ callDuration: duration }),

            // Add to call history
            addCallToHistory: (call) => set((state) => ({
                callHistory: [call, ...state.callHistory.slice(0, 49)] // Keep last 50 calls
            })),

            // Clear call history
            clearCallHistory: () => set({ callHistory: [] }),

            // Get call by ID
            getCallById: (callId) => {
                const { callHistory } = get();
                return callHistory.find(call => call.id === callId);
            }
        }),
        {
            name: 'call-store',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                callHistory: state.callHistory
            })
        }
    )
);