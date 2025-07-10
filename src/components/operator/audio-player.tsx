'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface AudioPlayerProps {
  src: string;
  canDownload?: boolean;
  fileName?: string;
}

const formatTime = (time: number) => {
  if (isNaN(time)) return '00:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export function AudioPlayer({ src, canDownload = false, fileName = 'recording.wav' }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
    };

    const setAudioTime = () => setCurrentTime(audio.currentTime);

    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', () => setIsPlaying(false));

    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', () => setIsPlaying(false));
    };
  }, []);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const handleTimeSliderChange = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    if (audioRef.current) {
      const newVolume = value[0];
      audioRef.current.volume = newVolume;
      setVolume(newVolume);
    }
  };
  
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="flex items-center gap-4 w-full bg-background p-2 rounded-lg">
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <Button variant="ghost" size="icon" onClick={handleRestart}>
        <RotateCcw className="h-5 w-5" />
      </Button>

      <Button variant="ghost" size="icon" onClick={togglePlayPause}>
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </Button>

      <div className="flex-grow flex items-center gap-2">
        <span className="text-xs font-mono text-muted-foreground">{formatTime(currentTime)}</span>
        <Slider
          value={[currentTime]}
          max={duration}
          step={1}
          onValueChange={handleTimeSliderChange}
          className="flex-grow"
        />
        <span className="text-xs font-mono text-muted-foreground">-{formatTime(duration - currentTime)}</span>
      </div>

      <div className="flex items-center gap-2 w-28">
         <Button variant="ghost" size="icon" onClick={() => handleVolumeChange([volume > 0 ? 0 : 1])}>
            {volume > 0 ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
         </Button>
        <Slider
          value={[volume]}
          max={1}
          step={0.05}
          onValueChange={handleVolumeChange}
        />
      </div>

      {canDownload && (
        <Button variant="outline" size="icon" onClick={handleDownload}>
          <Download className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
