
// backend/controllers/callController.js

const crypto = require('crypto');

class CallController {
  constructor(io) {
    this.io = io;
    this.activeCalls = new Map(); 
    this.userSockets = new Map();
    this.peerConnections = new Map(); 
  }

  registerUser(socketId, userId) {
    this.userSockets.set(userId, socketId);
    console.log(`✅ User ${userId} registered with socket ${socketId}`);
  }

  generateCallId() {
    return crypto.randomBytes(16).toString('hex');
  }

  async initiateCall(data) {
    const { fromUserId, toUserId, fromUserName, callType } = data;
        const toSocketId = this.userSockets.get(toUserId);
    if (!toSocketId) {
      return { success: false, message: 'User offline' };
    }

    const callId = this.generateCallId();
    const channelName = `call_${callId}`;

    // Store call data
    this.activeCalls.set(callId, {
      callId,
      callerId: fromUserId,
      callerName: fromUserName,
      receiverId: toUserId,
      channelName,
      callType,
      status: 'ringing',
      startTime: new Date(),
      participants: [fromUserId, toUserId]
    });

    this.io.to(toSocketId).emit('incoming_call', {
      callId,
      callerId: fromUserId,
      callerName: fromUserName,
      callType,
      channelName
    });

    return { success: true, callId, channelName };
  }

  acceptCall(data) {
    const { callId, userId } = data;
    const call = this.activeCalls.get(callId);
    
    if (!call) return { success: false, message: 'Call not found' };

    call.status = 'connected';
    this.activeCalls.set(callId, call);

    const callerSocketId = this.userSockets.get(call.callerId);
    if (callerSocketId) {
      this.io.to(callerSocketId).emit('call_accepted', {
        callId,
        acceptedBy: userId
      });
    }

    return { success: true };
  }

  rejectCall(data) {
    const { callId, userId } = data;
    const call = this.activeCalls.get(callId);
    
    if (!call) return { success: false };

    call.status = 'rejected';
    call.endTime = new Date();

    const callerSocketId = this.userSockets.get(call.callerId);
    if (callerSocketId) {
      this.io.to(callerSocketId).emit('call_rejected', {
        callId,
        rejectedBy: userId
      });
    }

    this.activeCalls.delete(callId);
    return { success: true };
  }
  endCall(data) {
    const { callId, userId } = data;
    const call = this.activeCalls.get(callId);
    
    if (!call) return { success: false };

    call.status = 'ended';
    call.endTime = new Date();
    call.participants.forEach(participantId => {
      const socketId = this.userSockets.get(participantId);
      if (socketId && participantId !== userId) {
        this.io.to(socketId).emit('call_ended', { callId });
      }
    });

    this.activeCalls.delete(callId);
    return { success: true };
  }
  handleWebRTCSignal(data) {
    const { toUserId, signal } = data;
    const toSocketId = this.userSockets.get(toUserId);
    
    if (toSocketId) {
      this.io.to(toSocketId).emit('webrtc_signal', signal);
    }
  }

  handleIceCandidate(data) {
    const { toUserId, candidate } = data;
    const toSocketId = this.userSockets.get(toUserId);
    
    if (toSocketId) {
      this.io.to(toSocketId).emit('ice_candidate', candidate);
    }
  }
  handleDisconnect(socketId, userId) {
    this.userSockets.delete(userId);
  
    this.activeCalls.forEach((call, callId) => {
      if (call.participants.includes(userId)) {
        this.endCall({ callId, userId });
      }
    });
  }
}

module.exports = CallController;