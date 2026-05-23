package logger

import (
	"fmt"
	"os"
	"time"
)

var Logger *MyLogger

func init() {
	Logger = NewLogger()
}

type Level int

const (
	InfoLevel  Level = iota // 0
	ErrorLevel              // 1
	FatalLevel              // 2
)

type MyLogger struct {
	level Level
}

func NewLogger() *MyLogger {
	return &MyLogger{
		level: InfoLevel,
	}
}

func (l *MyLogger) Info(format string, args ...interface{}) {
	if l.level <= InfoLevel {
		l.log("INFO", format, args...)
	}
}

func (l *MyLogger) Error(format string, args ...interface{}) {
	if l.level <= ErrorLevel {
		l.log("ERROR", format, args...)
	}
}

func (l *MyLogger) Fatal(format string, args ...interface{}) {
	l.log("FATAL", format, args...)
	os.Exit(1)
}

func (l *MyLogger) log(level string, format string, args ...interface{}) {
	timestamp := time.Now().Format("2006-01-02 15:04:05")
	message := fmt.Sprintf(format, args...)
	logEntry := fmt.Sprintf("[%s] [%s] %s\n", timestamp, level, message)

	if level == "INFO" {
		fmt.Fprint(os.Stdout, logEntry)
	} else {
		fmt.Fprint(os.Stderr, logEntry)
	}
}

func LogInfo(format string, args ...interface{}) {
	Logger.Info(format, args...)
}

func LogError(format string, args ...interface{}) {
	Logger.Error(format, args...)
}

func LogFatal(format string, args ...interface{}) {
	Logger.Fatal(format, args...)
}
