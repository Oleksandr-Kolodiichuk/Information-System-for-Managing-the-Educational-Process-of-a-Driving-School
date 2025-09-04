import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Download, ChevronLeft, ChevronRight, Menu, X, FileText, Upload, Trash2, List } from 'lucide-react';
import './MyLecturesComponent.css';

const MyLecturesComponent = ({ userInfo = null }) => {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [rotation, setRotation] = useState(0);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [thumbnails, setThumbnails] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageInput, setPageInput] = useState('1');
  const [currentPdfFile, setCurrentPdfFile] = useState(null);
  const [savedFiles, setSavedFiles] = useState([]);
  const [showFilesList, setShowFilesList] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [user, setUser] = useState(userInfo);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  const API_BASE_URL = 'http://localhost:5000/api';

  useEffect(() => {
    if (!user) {
      setUser({
        username: 'demo_teacher',
        role: 'teacher',
        isAuthenticated: true
      });
    }
  }, [user]);

  const getRequestHeaders = () => {
    if (!user || !user.isAuthenticated) {
      return null;
    }
    
    return {
      'Content-Type': 'application/json',
      'user-role': user.role || 'teacher',
      'username': user.username || 'demo_teacher'
    };
  };

  useEffect(() => {
    const loadPdfJs = async () => {
      try {
        if (window.pdfjsLib) {
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        };
        script.onerror = () => {
          setError('Failed to load PDF.js library');
        };
        document.head.appendChild(script);
      } catch (err) {
        setError('Error loading PDF.js');
      }
    };

    loadPdfJs();
  }, []);

  useEffect(() => {
    if (user && user.isAuthenticated) {
      loadSavedFiles();
    }
  }, [user]);

  const loadSavedFiles = async () => {
    try {
      const headers = getRequestHeaders();
      if (!headers) {
        setError('User not authenticated');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/pdf-files`, {
        headers
      });
      
      if (response.ok) {
        const files = await response.json();
        setSavedFiles(files);
      } else {
        console.error('Failed to load saved files');
      }
    } catch (err) {
      console.error('Error loading saved files:', err);
    }
  };

  const uploadFileToServer = async (file) => {
    const headers = getRequestHeaders();
    if (!headers) {
      setError('User not authenticated');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch(`${API_BASE_URL}/pdf-files/upload`, {
        method: 'POST',
        headers: {
          'user-role': headers['user-role'],
          'username': headers['username']
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();

      await loadSavedFiles();

      await loadPdfFromServer(result.id);
      
      setIsUploading(false);
      setUploadProgress(0);
      
      return result;
    } catch (err) {
      setError('Failed to upload file: ' + err.message);
      setIsUploading(false);
      setUploadProgress(0);
      throw err;
    }
  };

  const loadPdfFromServer = async (fileId) => {
    const headers = getRequestHeaders();
    if (!headers) {
      setError('User not authenticated');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/pdf-files/${fileId}`, {
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load PDF: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const infoResponse = await fetch(`${API_BASE_URL}/pdf-files/${fileId}/info`, {
        headers
      });
      const fileInfo = await infoResponse.json();
      
      setCurrentPdfFile(fileInfo);
      await loadPdf(url);
    } catch (err) {
      setError('Failed to load PDF from server: ' + err.message);
      setIsLoading(false);
    }
  };

  const deleteFileFromServer = async (fileId) => {
    const headers = getRequestHeaders();
    if (!headers) {
      setError('User not authenticated');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/pdf-files/${fileId}`, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        await loadSavedFiles();
        
        if (currentPdfFile && currentPdfFile.id === fileId) {
          setPdfDoc(null);
          setCurrentPdfFile(null);
          setTotalPages(0);
          setCurrentPage(1);
        }
      } else {
        throw new Error('Failed to delete file');
      }
    } catch (err) {
      setError('Failed to delete file: ' + err.message);
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      try {
        await uploadFileToServer(file);
      } catch (err) {
        setError('Failed to upload PDF file');
      }
    } else {
      setError('Please select a valid PDF file');
    }
    
    event.target.value = '';
  };

  const loadPdf = async (fileUrl) => {
    if (!fileUrl) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const loadingTask = window.pdfjsLib.getDocument(fileUrl);
      const pdf = await loadingTask.promise;
      
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      setIsLoading(false);
      
      generateThumbnails(pdf);
    } catch (err) {
      setError('Failed to load PDF file: ' + err.message);
      setIsLoading(false);
    }
  };

  const generateThumbnails = async (pdf) => {
    const thumbs = [];
    const thumbnailScale = 0.25;
    
    for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 20); pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: thumbnailScale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        thumbs.push({
          pageNum,
          dataUrl: canvas.toDataURL()
        });
      } catch (err) {
        console.error(`Error generating thumbnail for page ${pageNum}:`, err);
      }
    }
    
    setThumbnails(thumbs);
  };

  const renderPage = async (pageNumber) => {
    if (!pdfDoc || !canvasRef.current) return;
    
    try {
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale, rotation });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
    } catch (err) {
      console.error('Error rendering page:', err);
    }
  };

  useEffect(() => {
    if (pdfDoc) {
      renderPage(currentPage);
      setPageInput(currentPage.toString());
    }
  }, [pdfDoc, currentPage, scale, rotation]);

  const goToPage = (pageNum) => {
    const page = parseInt(pageNum);
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 4));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.25));
  const resetZoom = () => setScale(1.2);
  const rotatePage = () => setRotation(prev => (prev + 90) % 360);

  const handlePageInputChange = (e) => {
    setPageInput(e.target.value);
  };

  const downloadPdf = async () => {
    if (currentPdfFile) {
      const headers = getRequestHeaders();
      if (!headers) {
        setError('User not authenticated');
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/pdf-files/${currentPdfFile.id}`, {
          headers
        });
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = currentPdfFile.original_name || 'lecture.pdf';
        link.click();
        
        URL.revokeObjectURL(url);
      } catch (err) {
        setError('Failed to download file');
      }
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('uk-UA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user || !user.isAuthenticated) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '400px',
        flexDirection: 'column',
        gap: '20px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <FileText size={64} color="#6c757d" />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#495057', marginBottom: '10px' }}>Authentication Required</h2>
          <p style={{ color: '#6c757d' }}>Please log in to access your lectures.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p>Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (isUploading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p>Uploading PDF... {uploadProgress}%</p>
          <div style={{
            width: '200px',
            height: '6px',
            backgroundColor: '#e9ecef',
            borderRadius: '3px',
            margin: '10px auto',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${uploadProgress}%`,
              height: '100%',
              backgroundColor: '#007bff',
              transition: 'width 0.3s ease'
            }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '400px',
        flexDirection: 'column',
        gap: '20px',
        padding: '20px'
      }}>
        <FileText size={64} color="#dc3545" />
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ color: '#dc3545', marginBottom: '10px' }}>Error</h3>
          <p style={{ color: '#6c757d', marginBottom: '20px' }}>{error}</p>
          <div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                marginRight: '10px',
                cursor: 'pointer'
              }}
            >
              Upload New PDF
            </button>
            <button 
              onClick={() => {
                setError(null);
                setShowFilesList(true);
              }}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              View Saved Files
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!pdfDoc) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '400px',
        flexDirection: 'column',
        gap: '20px',
        padding: '20px'
      }}>
        <FileText size={64} color="#007bff" />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: '10px' }}>My Lectures</h2>
          <p style={{ color: '#6c757d', marginBottom: '20px' }}>Upload a new PDF or select from saved files</p>
          
          <div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                marginRight: '10px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Upload size={16} />
              Upload New PDF
            </button>
            
            <button 
              onClick={() => setShowFilesList(true)}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <List size={16} />
              View Saved Files ({savedFiles.length})
            </button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
        
        {showFilesList && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                borderBottom: '1px solid #dee2e6',
                paddingBottom: '15px'
              }}>
                <h3>Saved PDF Files</h3>
                <button
                  onClick={() => setShowFilesList(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '5px'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div>
                {savedFiles.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#6c757d' }}>No saved files found</p>
                ) : (
                  savedFiles.map((file) => (
                    <div key={file.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '15px',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      marginBottom: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText size={24} color="#007bff" />
                        <div>
                          <p style={{ margin: '0 0 5px 0', fontWeight: '500' }}>{file.original_name}</p>
                          <p style={{ margin: 0, fontSize: '14px', color: '#6c757d' }}>
                            {formatFileSize(file.file_size)} • {formatDate(file.upload_date)}
                          </p>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            loadPdfFromServer(file.id);
                            setShowFilesList(false);
                          }}
                          style={{
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Open
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this file?')) {
                              deleteFileFromServer(file.id);
                            }
                          }}
                          style={{
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            padding: '8px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ 
  display: 'flex', 
  flexDirection: 'column',
  height: 'calc(100vh - 265px)',
  marginBottom: '0px'
}}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '15px 20px',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>
            My Lectures - {currentPdfFile?.original_name || 'PDF Document'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={prevPage}
              disabled={currentPage <= 1}
              style={{
                background: 'none',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                padding: '8px',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage <= 1 ? 0.5 : 1
              }}
            >
              <ChevronLeft size={16} />
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input
                type="number"
                min="1"
                max={totalPages}
                value={pageInput}
                onChange={handlePageInputChange}
                onKeyPress={(e) => e.key === 'Enter' && goToPage(pageInput)}
                style={{
                  width: '60px',
                  padding: '4px 8px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  textAlign: 'center'
                }}
              />
              <span>of {totalPages}</span>
            </div>
            
            <button
              onClick={nextPage}
              disabled={currentPage >= totalPages}
              style={{
                background: 'none',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                padding: '8px',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage >= totalPages ? 0.5 : 1
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowFilesList(true)}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <List size={14} />
            Files ({savedFiles.length})
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <Upload size={14} />
            Upload
          </button>
          <div className="flex-controls">
            <button
              onClick={zoomOut}
              className="btn-icon"
              title="Zoom Out"
            >
              <ZoomOut className="icon-sm" />
            </button>
            <span className="zoom-text">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              className="btn-icon"
              title="Zoom In"
            >
              <ZoomIn className="icon-sm" />
            </button>
            <button
              onClick={resetZoom}
              className="btn-secondary"
            >
              Reset
            </button>
          </div>
          <div className="flex-controls">
            <button
              onClick={rotatePage}
              className="btn-icon"
              title="Rotate"
            >
              <RotateCw className="icon-sm" />
            </button>
            <button
              onClick={() => setShowThumbnails(!showThumbnails)}
              className="btn-icon"
              title="Toggle Thumbnails"
            >
              <Menu className="icon-sm" />
            </button>
            <button
              onClick={downloadPdf}
              className="btn-icon"
              title="Download"
              disabled={!currentPdfFile}
            >
              <Download className="icon-sm" />
            </button>
          </div>
        </div>
      </div>
      <div className="flex-main">
        {showThumbnails && (
          <div className="sidebar">
            <div className="sidebar-header">
              <h3 className="sidebar-title">Pages</h3>
              <button
                onClick={() => setShowThumbnails(false)}
                className="btn-small"
              >
                <X className="icon-sm" />
              </button>
            </div>
            <div className="sidebar-content">
              <div className="sidebar-grid">
                {thumbnails.map((thumb) => (
                  <div
                    key={thumb.pageNum}
                    onClick={() => goToPage(thumb.pageNum)}
                    className={`thumbnail-item ${currentPage === thumb.pageNum ? 'active' : ''}`}
                  >
                    <img
                      src={thumb.dataUrl}
                      alt={`Page ${thumb.pageNum}`}
                      className="thumbnail-image"
                    />
                    <p className="thumbnail-label">
                      Page {thumb.pageNum}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="pdf-viewer" ref={containerRef}>
          <div className="pdf-canvas-wrapper">
            <div className="pdf-canvas-container">
              <canvas
                ref={canvasRef}
                className="pdf-canvas"
                style={{
                  transform: `rotate(${rotation}deg)`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
      {showFilesList && pdfDoc && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Saved PDF Files</h3>
              <button
                onClick={() => setShowFilesList(false)}
                className="btn-small"
              >
                <X className="icon-sm" />
              </button>
            </div>
            
            <div className="files-list">
              {savedFiles.length === 0 ? (
                <p className="no-files-text">No saved files found</p>
              ) : (
                savedFiles.map((file) => (
                  <div 
                    key={file.id} 
                    className={`file-item ${currentPdfFile?.id === file.id ? 'active' : ''}`}
                  >
                    <div className="file-info">
                      <FileText className="icon-md" />
                      <div>
                        <p className="file-name">{file.original_name}</p>
                        <p className="file-details">
                          {formatFileSize(file.file_size)} • {formatDate(file.upload_date)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="file-actions">
                      {currentPdfFile?.id !== file.id && (
                        <button
                          onClick={() => {
                            loadPdfFromServer(file.id);
                            setShowFilesList(false);
                          }}
                          className="btn-primary btn-small"
                        >
                          Open
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this file?')) {
                            deleteFileFromServer(file.id);
                          }
                        }}
                        className="btn-danger btn-small"
                      >
                        <Trash2 className="icon-sm" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLecturesComponent;