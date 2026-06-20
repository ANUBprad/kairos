# Benchmark Report

**Generated:** 2026-06-20 17:04:35

## Summary

| Metric              | Value  |
| ------------------- | ------ |
| Total Queries       | 150    
| Accuracy            | 88.00% 
| Fallback Rate       | 12.00% 
| Avg Confidence      | 0.6108 
| Avg Chunks/Query    | 6.0    
| Avg Article Overlap | 0.8762 

## Latency

| Statistic | Total (ms) | Retrieval (ms) |
| --------- | ---------- | -------------- |
| Mean      | 198.2      | 198.1          
| Median    | 189.9      | —              
| P95       | 341.5      | 341.4          
| P99       | 350.0      | —              
| Min       | 50.6       | —              
| Max       | 350.5      | —              

## Failures

| Type            | Count | Rate   |
| --------------- | ----- | ------ |
| Fallback        | 18    | 12.00% 
| Empty Retrieval | 18    | 12.00% 
| Timeout         | 0     | 0.00%  

## Strategy Distribution

| Strategy                   | Count | Percentage |
| -------------------------- | ----- | ---------- |
| RETRIEVAL_TYPE_UNSPECIFIED | 50    | 33.3%      
| MULTI_VECTOR               | 50    | 33.3%      
| SELF_QUERYING              | 50    | 33.3%      

## Confidence Distribution

| Band   | Count | Percentage |
| ------ | ----- | ---------- |
| high   | 50    | 33.3%      
| medium | 50    | 33.3%      
| low    | 50    | 33.3%      

## Per-Type Breakdown

### COMPLEX

| Metric           | Value |
| ---------------- | ----- |
| Count            | 50    
| Fallback Rate    | 8.00% 
| Avg Latency (ms) | 191.5 
| Avg Recall       | N/A   

### MULTI_HOP

| Metric           | Value  |
| ---------------- | ------ |
| Count            | 50     
| Fallback Rate    | 26.00% 
| Avg Latency (ms) | 195.8  
| Avg Recall       | N/A    

### SIMPLE

| Metric           | Value |
| ---------------- | ----- |
| Count            | 50    
| Fallback Rate    | 2.00% 
| Avg Latency (ms) | 207.4 
| Avg Recall       | N/A   

---

*Report generated from 150 benchmark queries.*
